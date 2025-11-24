import Joi from "joi";
import { Request, Response } from "express";
import { getConnection, getRepository, In, IsNull, LessThanOrEqual, Like, MoreThanOrEqual, Not, Or } from "typeorm";
import { Bus } from "../../entities/Bus";
import { handleSuccess, handleError, joiErrorHandle } from "../../utils/responseHandler";
import { TicketType } from "../../entities/TicketType";
import { BusSchedule } from "../../entities/BusSchedule";
import { RouteClosure } from "../../entities/RouteClosure";
import { Route_Stops } from "../../entities/RouteStop";
import moment from "moment";
import { Booking } from "../../entities/Booking";
import { BookingPassenger } from "../../entities/BookingPassenger";
import { CurrencyExchangeRate } from "../../entities/currency_exchange_rate";

export const create_bus = async (req: Request, res: Response) => {
    try {
        const createBusSchema = Joi.object({
            bus_name: Joi.string().required(),
            bus_number_plate: Joi.string().required(),
            bus_registration_number: Joi.string().required(),
            number_of_seats: Joi.number().integer().min(1).required(),
        });

        const { error, value } = createBusSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { bus_name, bus_number_plate, bus_registration_number, number_of_seats } = value;

        const busRepository = getRepository(Bus);

        const busResult = await busRepository.findOne({
            where: [
                { bus_number_plate: bus_number_plate, is_deleted: false },
                { bus_registration_number: bus_registration_number, is_deleted: false }
            ]
        })

        if (busResult) {
            if (busResult.bus_number_plate === bus_number_plate) return handleError(res, 400, `Bus with number plate ${bus_number_plate} already exists.`);
            if (busResult.bus_registration_number === bus_registration_number) return handleError(res, 400, `Bus with registration number ${bus_registration_number} already exists.`);
        }

        const newBus = busRepository.create({
            bus_name,
            bus_number_plate,
            bus_registration_number,
            number_of_seats
        });

        await busRepository.save(newBus);

        return handleSuccess(res, 200, "Bus Created Successfully.");
    } catch (error: any) {
        console.error("Error in create_bus:", error);
        return handleError(res, 500, error.message);
    }
};

export const get_all_buses = async (req: Request, res: Response) => {
    try {
        const busRepository = getRepository(Bus);
        const buses = await busRepository.find({ where: { is_deleted: false, is_active: true }, order: { bus_id: 'DESC' } });
        return handleSuccess(res, 200, "Buses fetched successfully.", buses);
    } catch (error: any) {
        console.error("Error in get_all_buses:", error);
        return handleError(res, 500, error.message);
    }
};

export const getAllBusesBySearchLimit = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;

        const pageNumber = parseInt(page as string, 10);
        const pageLimit = parseInt(limit as string, 10);

        const offset = (pageNumber - 1) * pageLimit;

        const busRepository = getRepository(Bus);

        const [buses, total] = await busRepository.findAndCount({
            where: search ? [
                { bus_name: Like(`%${search}%`), is_deleted: false },
                { bus_number_plate: Like(`%${search}%`), is_deleted: false },
                { bus_registration_number: Like(`%${search}%`), is_deleted: false },
            ] : { is_deleted: false },
            order: { bus_id: 'DESC' },
            take: pageLimit,
            skip: offset,
        });

        const totalPages = Math.ceil(total / pageLimit);

        return handleSuccess(res, 200, "Buses fetched successfully.", {
            buses,
            pagination: {
                total,
                totalPages,
                currentPage: pageNumber,
                pageSize: pageLimit,
            },
        });
    } catch (error: any) {
        console.error("Error in getAllBusesBySearchLimit:", error);
        return handleError(res, 500, error.message);
    }
};

export const update_bus = async (req: Request, res: Response) => {
    try {
        const updateBusSchema = Joi.object({
            bus_id: Joi.number().required(),
            bus_name: Joi.string().required(),
            bus_number_plate: Joi.string().required(),
            bus_registration_number: Joi.string().required(),
            number_of_seats: Joi.number().integer().min(1).required(),
        });

        const { error, value } = updateBusSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const busRepository = getRepository(Bus);
        const { bus_id, bus_name, bus_number_plate, bus_registration_number, number_of_seats } = value;

        const bus = await busRepository.findOneBy({ bus_id: bus_id, is_deleted: false });
        if (!bus) return handleError(res, 404, "Bus not found.");

        const duplicateBus = await busRepository.findOne({
            where: [
                { bus_number_plate, bus_id: Not(bus_id), is_deleted: false },
                { bus_registration_number, bus_id: Not(bus_id), is_deleted: false }
            ],
        });

        if (duplicateBus) {
            if (duplicateBus.bus_number_plate === bus_number_plate) return handleError(res, 400, `Bus with number plate ${bus_number_plate} already exists.`);
            if (duplicateBus.bus_registration_number === bus_registration_number) return handleError(res, 400, `Bus with registration number ${bus_registration_number} already exists.`);
        }

        if (bus_name) bus.bus_name = bus_name;
        if (bus_number_plate) bus.bus_number_plate = bus_number_plate;
        if (bus_registration_number) bus.bus_registration_number = bus_registration_number;
        if (number_of_seats) bus.number_of_seats = number_of_seats;

        await busRepository.save(bus);

        return handleSuccess(res, 200, "Bus Updated Successfully.");
    } catch (error: any) {
        console.error("Error in update_bus:", error);
        return handleError(res, 500, error.message);
    }
};

export const update_bus_status = async (req: Request, res: Response) => {
    try {
        const updateBusSchema = Joi.object({
            bus_id: Joi.number().required(),
            is_active: Joi.boolean().required(),
        });

        const { error, value } = updateBusSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const busRepository = getRepository(Bus);
        const { bus_id, is_active } = value;

        const bus = await busRepository.findOneBy({ bus_id: bus_id, is_deleted: false });
        if (!bus) return handleError(res, 404, "Bus not found.");

        let response_message = 'Bus Activated Successfully '
        if (!is_active) response_message = 'Bus De-activated Successfully'
        bus.is_active = is_active

        await busRepository.save(bus);

        return handleSuccess(res, 200, response_message);
    } catch (error: any) {
        console.error("Error in update_bus:", error);
        return handleError(res, 500, error.message);
    }
};

export const delete_bus = async (req: Request, res: Response) => {
    try {
        const deleteBusSchema = Joi.object({
            bus_id: Joi.number().required()
        });

        const { error, value } = deleteBusSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { bus_id } = value;

        const busRepository = getRepository(Bus);

        const bus = await busRepository.findOneBy({ bus_id: bus_id, is_deleted: false });
        if (!bus) return handleError(res, 404, "Bus not found or already deleted.");

        if (bus) bus.is_deleted = true;
        await busRepository.save(bus);

        return handleSuccess(res, 200, "Bus Deleted Successfully.");
    } catch (error: any) {
        console.error("Error in delete_bus:", error);
        return handleError(res, 500, error.message);
    }
};

export interface BusScheduleWithTicketType extends BusSchedule {
    ticket_type: TicketType[];
}

export const bus_search = async (req: Request, res: Response) => {
    try {
        const createBusSchema = Joi.object({
            pickup_point: Joi.string().required(),
            dropoff_point: Joi.string().required(),
            travel_date: Joi.string().required(),
        });

        const { error, value } = createBusSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { pickup_point, dropoff_point, travel_date } = value;

        const connection = await getConnection();
        const busScheduleRepository = getRepository(BusSchedule);
        const routeClosureRepository = getRepository(RouteClosure);
        const routeStopsRepository = getRepository(Route_Stops);
        const bookingRepository = getRepository(Booking);
        const bookingPassengerRepository = getRepository(BookingPassenger);
        const currencyExchangeRepository = getRepository(CurrencyExchangeRate);

        const matchingCityPickupDropPoint = await connection.query('SELECT * FROM ticket_type WHERE startPointCityId = ? AND endPointCityId = ? AND is_active = 1', [pickup_point, dropoff_point]);

        if (!matchingCityPickupDropPoint || matchingCityPickupDropPoint.length === 0) return handleError(res, 200, 'No routes/lines available.');

        const travelDate = moment(travel_date);
        const weekday = travelDate.format('dddd');

        const allBusesForRoutes: BusSchedule[] = await busScheduleRepository.find({
            where: {
                route: In(matchingCityPickupDropPoint.filter((route: any) => route.Baseprice != null).map((route: any) => route.routeRouteId))
            },
            relations: ['bus', 'route'],
        });

        const closedRoutes = await routeClosureRepository.find({
            where: {
                route: In(matchingCityPickupDropPoint.map((route: any) => route.routeRouteId)),
                from_date: LessThanOrEqual(travelDate.toDate()),
                to_date: MoreThanOrEqual(travelDate.toDate())
            },
            relations: ['route']
        });
        const closedRouteIds = closedRoutes.map(rou => rou.route.route_id);

        const busesForSelectedDate: BusScheduleWithTicketType[] = [];

        for (const bus of allBusesForRoutes) {
            if (closedRouteIds.includes(bus.route.route_id)) {
                continue;
            }

            let isBusAvailable = false;

            if (!bus.available) {
                if (bus.from && bus.to) {
                    isBusAvailable = moment(travelDate).isBetween(moment(bus.from), moment(bus.to), 'day', '[]');
                }
            } else {
                isBusAvailable = true;
            }

            if (isBusAvailable) {
                if (bus.recurrence_pattern === 'Daily' ||
                    (['Weekly', 'Custom'].includes(bus.recurrence_pattern) && bus.days_of_week?.includes(weekday))) {

                    const getAllBooking = await bookingRepository.find({ where: { from: { city_id: pickup_point }, to: { city_id: dropoff_point }, route: { route_id: bus.route.route_id }, travel_date: travel_date, is_deleted: false } });

                    const bookingPassengers = await Promise.all(
                        getAllBooking.map(async (booking) => {
                            const passengers = await bookingPassengerRepository.find({
                                where: { booking: { id: booking.id }, selected_seat: Not(IsNull()) }
                            });
                            return { ...booking, passengers };
                        })
                    );

                    const totalPassengers = bookingPassengers.reduce((sum, booking) => sum + booking.passengers.length, 0);

                    const routeStopsData = await routeStopsRepository.find({
                        where: { route: { route_id: bus.route.route_id, is_deleted: false } },
                        relations: ["stop_city"],
                        order: { stop_order: "ASC" },
                    });

                    const pickupStop = await routeStopsRepository.findOne({
                        where: {
                            route: { route_id: bus.route.route_id, is_deleted: false },
                            stop_city: { city_id: pickup_point }
                        },
                        relations: ["stop_city"]
                    });

                    const dropoffStop = await routeStopsRepository.findOne({
                        where: {
                            route: { route_id: bus.route.route_id, is_deleted: false },
                            stop_city: { city_id: dropoff_point }
                        },
                        relations: ["stop_city"]
                    });

                    if (pickupStop && dropoffStop) {
                        let exchangeRate = 1;
                        if (pickupStop?.stop_city?.from_ukraine) {
                            const currencyData = await currencyExchangeRepository.findOne({
                                where: {
                                    from_currency: 'EUR',
                                    to_currency: 'UAH'
                                }
                            });

                            if (currencyData) {
                                exchangeRate = Number(currencyData.rate) || 1;
                            } else {
                                console.warn(`Exchange rate not found for -> ${exchangeRate}`);
                            }
                        }

                        const isValidTimeFormat = (time: string) => /^\d{2}:\d{2}$/.test(time);

                        if (!pickupStop?.departure_time || !isValidTimeFormat(pickupStop.departure_time)) {
                            console.warn(`Invalid or missing departure_time format for pickupStop:`, pickupStop);
                            continue;
                        }
                        if (!dropoffStop?.arrival_time || !isValidTimeFormat(dropoffStop.arrival_time)) {
                            console.warn(`Invalid or missing arrival_time format for dropoffStop:`, dropoffStop);
                            continue;
                        }

                        const departureTimeStr = `${travel_date} ${pickupStop?.departure_time || ''}`;
                        const arrivalTimeStr = `${travel_date} ${dropoffStop?.arrival_time || ''}`;

                        const departureTime = moment(departureTimeStr, 'YYYY-MM-DD HH:mm');
                        const arrivalTime = moment(arrivalTimeStr, 'YYYY-MM-DD HH:mm');

                        if (arrivalTime.isBefore(departureTime)) {
                            arrivalTime.add(1, 'days');
                        }

                        const now = moment();
                        if (travelDate.isSame(now, 'day') && departureTime.isSameOrBefore(now)) {
                            continue;
                        }

                        const duration = moment.duration(arrivalTime.diff(departureTime));

                        const matchingRoute = matchingCityPickupDropPoint.find((route: any) => route.routeRouteId === bus.route.route_id);
                        matchingRoute.Baseprice = matchingRoute?.Baseprice ? Number((matchingRoute.Baseprice * exchangeRate).toFixed(2)) : null;

                        busesForSelectedDate.push({
                            ...(bus as any),
                            departure_time: departureTime.format('DD-MM-YYYY HH:mm'),
                            arrival_time: arrivalTime.format('DD-MM-YYYY HH:mm'),
                            duration: `${duration.hours()} hours ${duration.minutes()} minutes`,
                            base_price: matchingRoute || null,
                            route_stops: routeStopsData,
                            pickupStop: pickupStop,
                            dropoffStop: dropoffStop,
                            total_booked_seats: totalPassengers,
                            travel_date: travelDate.format('DD-MM-YYYY')
                        });
                    } else {
                        console.error('One of the stops is missing: pickupStop or dropoffStop is null');
                    }
                }
            }
        }

        if (!busesForSelectedDate.length) {
            return handleError(res, 200, 'No buses available for the selected date.');
        }

        return handleSuccess(res, 200, 'Buses found successfully for the selected date.', busesForSelectedDate);
    } catch (error: any) {
        console.error('Error in bus_search:', error);
        return handleError(res, 500, error.message);
    }
};