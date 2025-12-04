import { Request, Response } from "express";
import Joi from "joi";
// import { getRepository } from "typeorm";
import { getRepository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { handleSuccess, handleError, joiErrorHandle } from "../../utils/responseHandler";
import { Route } from "../../entities/Route";
import { TicketDescription } from "../../entities/TicketDescription";
import { getConnection } from 'typeorm';
import { CurrencyExchangeRate } from "../../entities/currency_exchange_rate";
import { Route_Stops } from "../../entities/RouteStop";
import { RouteDiscount } from "../../entities/RouteDiscount";

// export const get_ticket_type_by_routeid = async (req: Request, res: Response) => {
//     try {
//         const ticketTypeSchema = Joi.object({
//             route_id: Joi.number().required(),
//             pickup_point: Joi.number().allow(null, ''),
//             dropoff_point: Joi.number().allow(null, '')
//         });

//         const { error, value } = ticketTypeSchema.validate(req.body);
//         if (error) return joiErrorHandle(res, error);

//         const connection = await getConnection();
//         const routeRepository = getRepository(Route);
//         const routeStopsRepository = getRepository(Route_Stops);
//         const currencyExchangeRepository = getRepository(CurrencyExchangeRate);

//         const findRoutes = await routeRepository.find({ where: { route_id: value.route_id } });
//         if (!findRoutes.length) return handleSuccess(res, 404, "No routes found for the given route ID", []);

//         const pickupStop = await routeStopsRepository.findOne({
//             where: {
//                 route: { route_id: value.route_id, is_deleted: false },
//                 stop_city: { city_id: value.pickup_point }
//             },
//             relations: ["stop_city"]
//         });

//         let exchangeRate = 1;
//         if (pickupStop?.stop_city?.from_ukraine) {
//             const currencyData = await currencyExchangeRepository.findOne({
//                 where: {
//                     from_currency: 'EUR',
//                     to_currency: 'UAH'
//                 }
//             });

//             if (currencyData) {
//                 exchangeRate = Number(currencyData.rate) || 1;
//             } else {
//                 console.warn(`Exchange rate not found for -> ${exchangeRate}`);
//             }
//         }

//         const newTicketTypes = await Promise.all(
//             findRoutes.map(async (val) => {
//                 var ticket_type
//                 if (!value.pickup_point || !value.dropoff_point) {
//                     ticket_type = await connection.query(`SELECT ticket_type.*, start_city.city_name AS start_city_name, end_city.city_name AS end_city_name FROM ticket_type LEFT JOIN city AS start_city ON start_city.city_id = ticket_type.startPointCityId LEFT JOIN city AS end_city ON end_city.city_id = ticket_type.endPointCityId WHERE routeRouteId = ${val.route_id} ORDER BY startPointCityId, endPointCityId ASC;`);
//                 } else {
//                     ticket_type = await connection.query(`SELECT ticket_type.*, start_city.city_name AS start_city_name, end_city.city_name AS end_city_name FROM ticket_type LEFT JOIN city AS start_city ON start_city.city_id = ticket_type.startPointCityId LEFT JOIN city AS end_city ON end_city.city_id = ticket_type.endPointCityId WHERE routeRouteId = ${val.route_id} AND ticket_type.startPointCityId = ${value.pickup_point} AND ticket_type.endPointCityId = ${value.dropoff_point} ORDER BY startPointCityId, endPointCityId ASC;`);
//                 }

//                 const ticket_type_column = await connection.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ticket_type' AND COLUMN_NAME != 'ticket_type_id' AND COLUMN_NAME != 'is_active' AND COLUMN_NAME != 'is_deleted' AND COLUMN_NAME != 'created_at' AND COLUMN_NAME != 'updated_at' AND COLUMN_NAME != 'routeRouteId' AND COLUMN_NAME != 'startPointCityId' AND COLUMN_NAME != 'endPointCityId'`);

//                 const priceColumnNames = ticket_type_column.map((col: any) => col.COLUMN_NAME);

//                 const convertedTicketType = ticket_type.map((row: any) => {
//                     const newRow = { ...row };
//                     priceColumnNames.forEach((col: string) => {
//                         if (newRow[col] !== null && !isNaN(newRow[col])) {
//                             newRow[col] = (Number(newRow[col]) * exchangeRate).toFixed(2);
//                         }
//                     });
//                     return newRow;
//                 });

//                 return { ...val, ticket_type: convertedTicketType, ticket_type_column }
//             })
//         );

//         return handleSuccess(res, 200, "Ticket types retrieved successfully", newTicketTypes);
//     } catch (error: any) {
//         console.log(error);
//         return handleError(res, 500, 'Internal Server Error');
//     }
// };



export const get_ticket_type_by_routeid = async (req: Request, res: Response) => {
    try {
        const ticketTypeSchema = Joi.object({
            route_id: Joi.number().required(),
            pickup_point: Joi.number().allow(null, ''),
            dropoff_point: Joi.number().allow(null, '')
        });

        const { error, value } = ticketTypeSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const connection = await getConnection();
        const routeRepository = getRepository(Route);
        const routeStopsRepository = getRepository(Route_Stops);
        const currencyExchangeRepository = getRepository(CurrencyExchangeRate);
        const routeDiscountRepository = getRepository(RouteDiscount);

        const findRoutes = await routeRepository.find({ where: { route_id: value.route_id } });
        if (!findRoutes.length) return handleSuccess(res, 404, "No routes found for the given route ID", []);

        const pickupStop = await routeStopsRepository.findOne({
            where: {
                route: { route_id: value.route_id, is_deleted: false },
                stop_city: { city_id: value.pickup_point }
            },
            relations: ["stop_city"]
        });

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

        const today = new Date();

        const newTicketTypes = await Promise.all(
            findRoutes.map(async (val) => {

                // 🟡 Fetch active discount for this route
                const activeDiscount = await routeDiscountRepository.findOne({
                    where: {
                        route: { route_id: val.route_id },
                        from_date: LessThanOrEqual(today),
                        to_date: MoreThanOrEqual(today),
                        is_deleted: false
                    },
                    order: { discound_id: 'DESC' } // latest discount if multiple
                });

                var ticket_type;
                if (!value.pickup_point || !value.dropoff_point) {
                    ticket_type = await connection.query(`SELECT ticket_type.*, start_city.city_name AS start_city_name, end_city.city_name AS end_city_name FROM ticket_type LEFT JOIN city AS start_city ON start_city.city_id = ticket_type.startPointCityId LEFT JOIN city AS end_city ON end_city.city_id = ticket_type.endPointCityId WHERE routeRouteId = ${val.route_id} ORDER BY startPointCityId, endPointCityId ASC;`);
                } else {
                    ticket_type = await connection.query(`SELECT ticket_type.*, start_city.city_name AS start_city_name, end_city.city_name AS end_city_name FROM ticket_type LEFT JOIN city AS start_city ON start_city.city_id = ticket_type.startPointCityId LEFT JOIN city AS end_city ON end_city.city_id = ticket_type.endPointCityId WHERE routeRouteId = ${val.route_id} AND ticket_type.startPointCityId = ${value.pickup_point} AND ticket_type.endPointCityId = ${value.dropoff_point} ORDER BY startPointCityId, endPointCityId ASC;`);
                }

                const ticket_type_column = await connection.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ticket_type' AND COLUMN_NAME != 'ticket_type_id' AND COLUMN_NAME != 'is_active' AND COLUMN_NAME != 'is_deleted' AND COLUMN_NAME != 'created_at' AND COLUMN_NAME != 'updated_at' AND COLUMN_NAME != 'routeRouteId' AND COLUMN_NAME != 'startPointCityId' AND COLUMN_NAME != 'endPointCityId'`);

                const priceColumnNames = ticket_type_column.map((col: any) => col.COLUMN_NAME);

                const convertedTicketType = ticket_type.map((row: any) => {
                    const newRow = { ...row };
                    priceColumnNames.forEach((col: string) => {
                        if (newRow[col] !== null && !isNaN(newRow[col])) {

                            // 🔹 Apply currency conversion
                            let updatedPrice = Number(newRow[col]) * exchangeRate;

                            // 🔹 Apply route discount if exists
                            if (activeDiscount && activeDiscount.discount_value) {
                                const discountValue = Number(activeDiscount.discount_value);
                                if (activeDiscount.discount_type === 'decrease') {
                                    updatedPrice = updatedPrice - (updatedPrice * discountValue) / 100;
                                } else if (activeDiscount.discount_type === 'increase') {
                                    updatedPrice = updatedPrice + (updatedPrice * discountValue) / 100;
                                } else if (activeDiscount.discount_type === 'amount') {
                                    updatedPrice = updatedPrice - discountValue; // fixed amount decrease
                                }
                            }

                            newRow[col] = updatedPrice.toFixed(2);
                        }
                    });
                    return newRow;
                });

                return { ...val, ticket_type: convertedTicketType, ticket_type_column }
            })
        );

        return handleSuccess(res, 200, "Ticket types retrieved successfully", newTicketTypes);
    } catch (error: any) {
        console.log(error);
        return handleError(res, 500, 'Internal Server Error');
    }
};


export const getTicketDescription = async (req: Request, res: Response) => {
    try {

        const repo = getRepository(TicketDescription);
        const list = await repo.find({
            order: { created_at: "DESC" }
        });

        return handleSuccess(res, 200, "Ticket Description Fetched Successfully.", list);
    } catch {
        return handleError(res, 500, "Error fetching tickets");
    }
};
