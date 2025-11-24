import { Request, Response } from "express";
import Joi, { not } from "joi";
import { getRepository, In, Like, Not, getConnection } from "typeorm";
import { handleSuccess, handleError, joiErrorHandle } from "../../utils/responseHandler";
import { Route } from "../../entities/Route";
import { TicketType } from "../../entities/TicketType";
import { Route_Stops } from "../../entities/RouteStop";
import { BusSchedule } from "../../entities/BusSchedule";
import { BookingPassenger } from "../../entities/BookingPassenger";
import { CurrencyExchangeRate } from "../../entities/currency_exchange_rate";

export const create_route = async (req: Request, res: Response) => {
    try {
        const createRouteSchema = Joi.object({
            title: Joi.string().required(),
            description: Joi.string().required().allow(""),
            route_stops: Joi.string().required(),
        });

        const { error, value } = createRouteSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const routeRepository = getRepository(Route);
        const routeStopsRepository = getRepository(Route_Stops);
        const ticketTypeRepository = getRepository(TicketType);

        value.route_stops = value.route_stops.split(',').map(Number);

        const duplicateRoute = await routeRepository.findOne({ where: { title: value.title, is_deleted: false } });
        if (duplicateRoute) return handleError(res, 400, "This route/line title already exists. Please add a different route title.");

        const newRoute = routeRepository.create(value);
        await routeRepository.save(newRoute);

        if (value.route_stops.length > 0) {
            for (let i = 0; i < value.route_stops.length; i++) {
                const stop_city_id = value.route_stops[i];
                const newStopData: any = {
                    route: newRoute,
                    stop_city: stop_city_id,
                    stop_order: i + 1,
                    arrival_time: i === 0 ? null : '',
                    departure_time: i === value.route_stops.length - 1 ? null : '',
                    stop_time: i === 0 || i === value.route_stops.length - 1 ? null : '',
                };

                const newStop = routeStopsRepository.create(newStopData);
                await routeStopsRepository.save(newStop);

                for (let j = i + 1; j < value.route_stops.length; j++) {
                    const newTicketTypes: any = {
                        route: newRoute,
                        start_point: value.route_stops[i],
                        end_point: value.route_stops[j],
                    };
                    const newTicketType = ticketTypeRepository.create(newTicketTypes);
                    await ticketTypeRepository.save(newTicketType);
                }
            }
        }

        return handleSuccess(res, 200, "Route/Line Created Successfully.");
    } catch (error: any) {
        console.error("Error in create_route:", error);
        return handleError(res, 500, error.message);
    }
};

export const get_all_routes = async (req: Request, res: Response) => {
    try {
        const routeRepository = getRepository(Route);
        const routeStopsRepository = getRepository(Route_Stops);

        const routes = await routeRepository.find({ where: { is_deleted: false }, order: { route_id: 'DESC' } });
        if (!routes.length) return handleError(res, 404, 'No routes found.');

        const routesWithStops = await Promise.all(
            routes.map(async (route) => {
                const stops = await routeStopsRepository.find({
                    where: { route: { route_id: route.route_id } },
                    relations: ["stop_city"],
                    order: { stop_order: 'ASC' },
                });
                return { ...route, route_stops: stops };
            })
        );

        return handleSuccess(res, 200, "Routes fetched successfully.", routesWithStops);
    } catch (error: any) {
        console.error("Error in get_all_routes:", error);
        return handleError(res, 500, error.message);
    }
};

export const get_all_active_routes = async (req: Request, res: Response) => {
    try {
        const routeRepository = getRepository(Route);

        const routes = await routeRepository.find({ where: { is_deleted: false, is_active: true }, order: { route_id: 'DESC' } });
        if (!routes.length) return handleError(res, 404, 'No routes found.');

        return handleSuccess(res, 200, "Routes fetched successfully.", routes);
    } catch (error: any) {
        console.error("Error in get_all_routes:", error);
        return handleError(res, 500, error.message);
    }
};

export const get_all_routes_by_search_limit = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 10, search = '', filter = '' } = req.query;

        const pageNumber = parseInt(page as string, 10);
        const pageLimit = parseInt(limit as string, 10);

        const offset = (pageNumber - 1) * pageLimit;

        const routeRepository = getRepository(Route);

        const [routes, total] = await routeRepository.findAndCount({
            where: {
                is_deleted: false,
                ...(filter && { route_direction: Like(`%${filter}%`) }),
                ...(search && {
                    pickup_point: { city_name: Like(`%${search}%`) }
                }),
                ...(search && {
                    pickup_point: { country_name: Like(`%${search}%`) }
                }),
                ...(search && {
                    dropoff_point: { city_name: Like(`%${search}%`) }
                }),
                ...(search && {
                    dropoff_point: { country_name: Like(`%${search}%`) }
                })
            },
            order: { route_id: 'DESC' },
            relations: ['pickup_point', 'dropoff_point'],
            take: pageLimit,
            skip: offset,
        });

        const totalPages = Math.ceil(total / pageLimit);

        return handleSuccess(res, 200, "Routes fetched successfully.", {
            routes,
            pagination: {
                total,
                totalPages,
                currentPage: pageNumber,
                pageSize: pageLimit,
            },
        });
    } catch (error: any) {
        console.error("Error in get_all_routes_by_search_limit:", error);
        return handleError(res, 500, error.message);
    }
};

export const get_route_by_id = async (req: Request, res: Response) => {
    try {
        const getRouteSchema = Joi.object({
            route_id: Joi.number().required()
        });

        const { error, value } = getRouteSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { route_id } = value;
        const routeRepository = getRepository(Route);
        const routeStopsRepository = getRepository(Route_Stops);

        const route = await routeRepository.findOne({ where: { route_id, is_deleted: false } });
        if (!route) return handleError(res, 404, "Route not found.");

        const routeStops = await routeStopsRepository.find({
            where: { route: { route_id: route_id } },
            relations: ["stop_city"],
            order: { stop_order: "ASC" },
        });
        const routeWithStops = { ...route, route_stops: routeStops };

        return handleSuccess(res, 200, "Route fetched successfully.", routeWithStops);
    } catch (error: any) {
        console.error("Error in get_route_by_id:", error);
        return handleError(res, 500, error.message);
    }
};

export const update_route = async (req: Request, res: Response) => {
    try {
        const updateRouteSchema = Joi.object({
            route_id: Joi.number().required(),
            title: Joi.string().required(),
            description: Joi.string().required().allow(""),
            route_stops: Joi.string().required().allow(""),
            is_active: Joi.boolean().optional(),
        });

        const { error, value } = updateRouteSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const routeRepository = getRepository(Route);
        const routeStopsRepository = getRepository(Route_Stops);
        const ticketTypeRepository = getRepository(TicketType);
        if (value.route_stops) {
            value.route_stops = value.route_stops.split(',').map(Number);
        }

        const route = await routeRepository.findOne({ where: { route_id: value.route_id, is_deleted: false } });
        if (!route) return handleError(res, 404, "Route not found.");

        const duplicateRoute = await routeRepository.findOne({ where: { title: value.title, route_id: Not(value.route_id), is_deleted: false } });
        if (duplicateRoute) return handleError(res, 400, "This route/line title already exists. Please add a different route title.");

        let isRouteUpdated = false;
        if (route.title !== value.title || route.description !== value.description || route.is_active !== value.is_active) {
            route.title = value.title;
            route.description = value.description;
            route.is_active = value.is_active ?? route.is_active;
            await routeRepository.save(route);
            isRouteUpdated = true;
        }
        value.route_stops.length > 0 ? await routeStopsRepository.delete({ route: { route_id: route.route_id } }) : '';
        let isStopsUpdated = false;
        for (let i = 0; i < value.route_stops.length; i++) {
            const stop_city_id = value.route_stops[i];
            const newStopData: any = {
                route: route,
                stop_city: stop_city_id,
                stop_order: i + 1,
                arrival_time: i === 0 ? null : '',
                departure_time: i === value.route_stops.length - 1 ? null : '',
                stop_time: i === 0 || i === value.route_stops.length - 1 ? null : '',
            };
            const newStop = routeStopsRepository.create(newStopData);
            await routeStopsRepository.save(newStop);
            isStopsUpdated = true;
        }

        for (let i = 0; i < value.route_stops.length; i++) {
            for (let j = i + 1; j < value.route_stops.length; j++) {
                const startStop = value.route_stops[i];
                const endStop = value.route_stops[j];
                if (startStop !== endStop) {
                    const existingTicketType = await ticketTypeRepository.findOne({
                        where: {
                            route: { route_id: route.route_id },
                            start_point: { city_id: startStop },
                            end_point: { city_id: endStop },
                        },
                    });

                    if (!existingTicketType) {
                        const newTicketType: any = {
                            route: route,
                            start_point: startStop,
                            end_point: endStop,
                        };

                        const ticketType = ticketTypeRepository.create(newTicketType);
                        await ticketTypeRepository.save(ticketType);
                    }
                }
            }
        }

        if (isRouteUpdated && isStopsUpdated) {
            return handleSuccess(res, 200, "Route and stops updated successfully.");
        } else if (isRouteUpdated) {
            return handleSuccess(res, 200, "Route updated successfully.");
        } else if (isStopsUpdated) {
            return handleSuccess(res, 200, "Route stops updated successfully.");
        } else {
            return handleSuccess(res, 200, "Route updated successfully.");
        }
    } catch (error: any) {
        console.error("Error in update_route:", error);
        return handleError(res, 500, error.message);
    }
};

export const update_route_status = async (req: Request, res: Response) => {
    try {
        const updateRouteStatusSchema = Joi.object({
            route_id: Joi.number().required(),
            is_active: Joi.boolean().required(),
        });

        const { error, value } = updateRouteStatusSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { route_id, is_active } = value;
        const routeRepository = getRepository(Route);
        const route = await routeRepository.findOneBy({ route_id: route_id, is_deleted: false });
        if (!route) return handleError(res, 404, "Route not found.");

        let response_message = 'Route Activated Successfully '
        if (!is_active) response_message = 'Route De-activated Successfully'
        route.is_deleted = is_active
        await routeRepository.save(route);

        return handleSuccess(res, 200, response_message);
    } catch (error: any) {
        console.error("Error in update_route:", error);
        return handleError(res, 500, error.message);
    }
};

export const delete_route = async (req: Request, res: Response) => {
    try {
        const deleteRouteSchema = Joi.object({
            route_id: Joi.number().required()
        });

        const { error, value } = deleteRouteSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { route_id } = value;
        const routeRepository = getRepository(Route);

        const route = await routeRepository.findOne({ where: { route_id: route_id, is_deleted: false } });

        if (!route) return handleError(res, 404, "Route not found or already deleted.");

        if (route) route.is_deleted = true
        await routeRepository.save(route);

        return handleSuccess(res, 200, "Route Deleted Successfully.");
    } catch (error: any) {
        console.error("Error in delete_route:", { error: error.message, route_id: req.body?.route_id });
        return handleError(res, 500, error.message);
    }
};

export const update_departuretime = async (req: Request, res: Response) => {
    try {
        const ticketTypeSchema = Joi.array().items(
            Joi.object({
                stop_id: Joi.number().required(),
                ...Object.fromEntries(
                    ['arrival_time', 'stop_time', 'departure_time'].map(field => [
                        field, Joi.string().allow(null)
                    ])
                ),
            })
        );

        const { error, value } = ticketTypeSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const routeStopsRepository = getRepository(Route_Stops);

        for (const val of value) {
            const updateFields: Partial<Route_Stops> = {};

            if (val.arrival_time !== null) updateFields.arrival_time = val.arrival_time;
            if (val.stop_time !== null) updateFields.stop_time = val.stop_time;
            if (val.departure_time !== null) updateFields.departure_time = val.departure_time;

            await routeStopsRepository.update(
                { stop_id: val.stop_id },
                updateFields
            );
        }

        return handleSuccess(res, 200, "Departure times updated successfully");
    } catch (error: any) {
        console.error("Error in update_departuretime_routeid:", error);
        return handleError(res, 500, error.message);
    }
};

export const create_copy_route = async (req: Request, res: Response) => {
    try {
        const createReverseRouteSchema = Joi.object({
            route_id: Joi.number().required(),
        });

        const { error, value } = createReverseRouteSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const connection = await getConnection();
        const routeRepository = getRepository(Route);
        const routeStopsRepository = getRepository(Route_Stops);
        const busScheduleRepository = getRepository(BusSchedule);

        const existingRoute = await routeRepository.findOne({ where: { route_id: value.route_id, is_deleted: false } });
        if (!existingRoute) return handleError(res, 404, 'Route not found.');

        const routeStops = await routeStopsRepository.find({ where: { route: { route_id: existingRoute.route_id } }, order: { stop_order: "ASC" }, relations: ['stop_city'] });

        const newRoute = routeRepository.create({
            title: existingRoute.title,
            description: existingRoute.description
        });
        await routeRepository.save(newRoute);

        newRoute.title = `${newRoute.title} (Summer${newRoute.route_id})`;
        await routeRepository.save(newRoute);

        for (let i = 0; i < routeStops.length; i++) {
            const newStop = routeStopsRepository.create({
                route: newRoute,
                stop_city: routeStops[i].stop_city,
                stop_order: i + 1,
                arrival_time: routeStops[i].arrival_time,
                departure_time: routeStops[i].departure_time,
                stop_time: routeStops[i].stop_time,
            });
            await routeStopsRepository.save(newStop);
        }

        const existingTicketTypes = await connection.query('SELECT * FROM `ticket_type` WHERE routeRouteId = ? ORDER BY ticket_type_id ASC;', [existingRoute.route_id])

        for (const ticketType of existingTicketTypes) {
            delete ticketType.ticket_type_id
            delete ticketType.is_active
            delete ticketType.routeRouteId
            delete ticketType.is_deleted
            delete ticketType.created_at
            delete ticketType.updated_at

            ticketType.routeRouteId = newRoute.route_id

            await connection.query(`INSERT INTO ticket_type SET ?`, [ticketType]);
        }

        const busSchedule = await busScheduleRepository.findOne({ where: { route: { route_id: existingRoute.route_id } }, relations: ['bus'] });
        if (busSchedule) {
            const { schedule_id, created_at, updated_at, ...busScheduleData } = busSchedule;
            const newBusSchedule = busScheduleRepository.create({
                ...busScheduleData,
                route: newRoute,
            });
            await busScheduleRepository.save(newBusSchedule);
        }
        return handleSuccess(res, 200, "Route/Line copied successfully.");
    } catch (error: any) {
        console.error("Error in create_copy_route:", error);
        return handleError(res, 500, error.message);
    }
};

export const updateDeleteRouteStatusById = async (req: Request, res: Response) => {
    try {
        const updateDeleteRouteSchema = Joi.object({
            route_id: Joi.number().required(),
            is_delete: Joi.boolean().valid(true, false).required()
        });

        const { error, value } = updateDeleteRouteSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const routeRepository = getRepository(Route);

        const route = await routeRepository.findOne({ where: { route_id: value.route_id } });
        if (!route) return res.status(404).json({ message: "Route not found" });

        route.is_deleted = value.is_delete;
        await routeRepository.save(route);

        return handleSuccess(res, 200, `Route ${value.is_delete ? "archived" : "restored"} successfully.`);
    } catch (error: any) {
        console.error("Error in updateDeleteRouteStatusById:", error);
        return handleError(res, 500, error.message);
    }
};

export const get_all_deleted_routes = async (req: Request, res: Response) => {
    try {
        const routeRepository = getRepository(Route);
        const routeStopsRepository = getRepository(Route_Stops);

        const [routes, total] = await routeRepository.findAndCount({
            where: {
                is_deleted: true
            },
            order: { updated_at: 'DESC' },
        });

        const routesWithStops = await Promise.all(
            routes.map(async (route) => {
                const stops = await routeStopsRepository.find({
                    where: { route: { route_id: route.route_id } },
                    relations: ["stop_city"],
                    order: { stop_order: 'ASC' },
                });
                return { ...route, route_stops: stops };
            })
        );


        return handleSuccess(res, 200, "Deleted routes fetched successfully.", routesWithStops);
    } catch (error: any) {
        console.error("Error in get_all_routes_by_search_limit:", error);
        return handleError(res, 500, error.message);
    }
};

export const get_all_booking_by_route_id = async (req: Request, res: Response) => {
    try {
        const createReverseRouteSchema = Joi.object({
            route_id: Joi.number().required(),
            from_date: Joi.string().optional().allow("", null),
            to_date: Joi.string().optional().allow("", null)
        });

        const { error, value } = createReverseRouteSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const routeRepository = getRepository(Route);
        const routeStopsRepository = getRepository(Route_Stops);
        const bookingPassengerRepository = getRepository(BookingPassenger);
        const currencyExchangeRepository = getRepository(CurrencyExchangeRate);

        const existingRoute = await routeRepository.findOne({ where: { route_id: value.route_id, is_deleted: false } });
        if (!existingRoute) return handleError(res, 404, 'Route not found.');

        const routeStops = await routeStopsRepository.find({ where: { route: { route_id: existingRoute.route_id } }, order: { stop_order: "ASC" }, relations: ['stop_city'] });

        let query = bookingPassengerRepository
            .createQueryBuilder('bp')
            .innerJoin('bp.booking', 'booking')
            .innerJoin('booking.from', 'fromCity')
            .innerJoin('booking.to', 'toCity')
            .select('fromCity.city_id', 'start')
            .addSelect('toCity.city_id', 'end')
            .addSelect('COUNT(bp.passenger_id)', 'totalTickets')
            .addSelect('SUM(CAST(bp.price AS DECIMAL(10,2)))', 'totalAmount')
            .where('booking.route = :routeId', { routeId: value.route_id });

        if (value.from_date && value.to_date) {
            query = query.andWhere('DATE(booking.travel_date) BETWEEN :fromDate AND :toDate', {
                fromDate: value.from_date,
                toDate: value.to_date
            });
        }

        const bookings = await query
            .groupBy('fromCity.city_id')
            .addGroupBy('toCity.city_id')
            .getRawMany();

        const currencyData = await currencyExchangeRepository.findOne({
            where: {
                from_currency: 'EUR',
                to_currency: 'UAH'
            }
        });

        const bookingMap = new Map();
        for (const b of bookings) {
            bookingMap.set(`${b.start}-${b.end}`, {
                tickets: Number(b.totalTickets),
                amount: Number(b.totalAmount),
            });
        }

        const matrix: string[][] = [];
        const rowTotals: number[] = [];

        for (let i = 0; i < routeStops.length; i++) {
            const row: string[] = [];
            let rowPassengerTotal = 0;

            for (let j = 0; j < routeStops.length; j++) {
                const fromId = routeStops[i].stop_city.city_id;
                const toId = routeStops[j].stop_city.city_id;
                const fromCity = routeStops[i].stop_city;

                if (fromId === toId) {
                    row.push('--');
                } else {
                    const key = `${fromId}-${toId}`;
                    const data = bookingMap.get(key);
                    if (data) {
                        const amount = fromCity.from_ukraine ? (currencyData?.rate ? data.amount / currencyData.rate : data.amount) : data.amount;
                         rowPassengerTotal += data.tickets;
                        row.push(`${data.tickets} / ${amount.toFixed(2)} €`);
                    } else {
                        row.push('--');
                    }
                }
            }
            row.push(`${rowPassengerTotal} passenger`);
            rowTotals.push(rowPassengerTotal)
            matrix.push(row);
        }

        return res.json({
            header: [
                ...routeStops.map(s => ({
                    name: s.stop_city?.city_name || 'Unknown',
                    from_ukraine: s.stop_city?.from_ukraine
                })),
                { name: 'Total Passenger', from_ukraine: false }
            ],
            rows: routeStops.map((s, i) => ({
                stopName: s.stop_city?.city_name || 'Unknown',
                rowData: matrix[i],
            })),
        });
    } catch (error: any) {
        console.error("Error in get_all_booking_by_route_id:", error);
        return handleError(res, 500, error.message);
    }
};