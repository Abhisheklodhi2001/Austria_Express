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
import moment from "moment";

// export const get_ticket_type_return_by_routeid = async (req: Request, res: Response) => {
//   try {
//     const ticketTypeSchema = Joi.object({
//       route_id: Joi.number().required(),
//       pickup_point: Joi.number().allow(null, ''),
//       dropoff_point: Joi.number().allow(null, ''),
//       return_date: Joi.string().required()
//     });

//     const { error, value } = ticketTypeSchema.validate(req.body);
//     if (error) return joiErrorHandle(res, error);

//     const connection = await getConnection();
//     const routeRepository = getRepository(Route);
//     const routeStopsRepository = getRepository(Route_Stops);
//     const currencyExchangeRepository = getRepository(CurrencyExchangeRate);
//     const discountRepository = getRepository(RouteDiscount);

//     const returnDate = moment(value.return_date).toDate();

//     // ROUTE EXIST CHECK
//     const findRoutes = await routeRepository.find({
//       where: { route_id: value.route_id }
//     });

//     if (!findRoutes.length) 
//         return handleSuccess(res, 404, "No routes found for this route ID", []);

//     // SWAP PICKUP AND DROPOFF FOR RETURN
//     const returnPickup = value.dropoff_point;
//     const returnDropoff = value.pickup_point;

//     // PICKUP STOP - CHECK EXCHANGE RATE
//     const pickupStop = await routeStopsRepository.findOne({
//       where: {
//         route: { route_id: value.route_id, is_deleted: false },
//         stop_city: { city_id: returnPickup }
//       },
//       relations: ["stop_city"]
//     });

//     let exchangeRate = 1;

//     if (pickupStop?.stop_city?.from_ukraine) {
//       const currencyData = await currencyExchangeRepository.findOne({
//         where: { from_currency: "EUR", to_currency: "UAH" }
//       });
//       if (currencyData) exchangeRate = Number(currencyData.rate) || 1;
//     }

//     const returnTicketTypes = await Promise.all(
//       findRoutes.map(async (routeItem: any) => {

//         // FETCH TICKET TYPE FOR RETURN (SWAPPED START/END)
//         let ticket_type;
//         if (!returnPickup || !returnDropoff) {
//           ticket_type = await connection.query(`
//             SELECT tt.*, 
//               start_city.city_name AS start_city_name,
//               end_city.city_name AS end_city_name
//             FROM ticket_type tt
//             LEFT JOIN city start_city ON start_city.city_id = tt.startPointCityId
//             LEFT JOIN city end_city ON end_city.city_id = tt.endPointCityId
//             WHERE tt.routeRouteId = ${routeItem.route_id}
//             ORDER BY startPointCityId, endPointCityId ASC;
//           `);
//         } else {
//           ticket_type = await connection.query(`
//             SELECT tt.*, 
//               start_city.city_name AS start_city_name,
//               end_city.city_name AS end_city_name
//             FROM ticket_type tt
//             LEFT JOIN city start_city ON start_city.city_id = tt.startPointCityId
//             LEFT JOIN city end_city ON end_city.city_id = tt.endPointCityId
//             WHERE 
//               tt.routeRouteId = ${routeItem.route_id}
//               AND tt.startPointCityId = ${returnPickup}
//               AND tt.endPointCityId = ${returnDropoff}
//             ORDER BY startPointCityId, endPointCityId ASC;
//           `);
//         }

//         // GET ALL PRICE COLUMNS DYNAMICALLY
//         const ticket_type_column = await connection.query(`
//           SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
//           WHERE TABLE_NAME = 'ticket_type'
//             AND COLUMN_NAME NOT IN 
//               ('ticket_type_id','is_active','is_deleted','created_at','updated_at','routeRouteId','startPointCityId','endPointCityId')
//         `);

//         const priceColumnNames = ticket_type_column.map((c: any) => c.COLUMN_NAME);

//         // BASE PRICE BEFORE DISCOUNT
//         let baseTicketType = ticket_type.map((row: any) => {
//           const newRow = { ...row };
//           priceColumnNames.forEach((col: string) => {
//             if (newRow[col] !== null && !isNaN(newRow[col])) {
//               newRow[col] = Number(newRow[col]) * exchangeRate;
//             }
//           });

//           // SWAP start/end IDs and names
//           const tmpId = newRow.startPointCityId;
//           newRow.startPointCityId = newRow.endPointCityId;
//           newRow.endPointCityId = tmpId;

//           const tmpName = newRow.start_city_name;
//           newRow.start_city_name = newRow.end_city_name;
//           newRow.end_city_name = tmpName;

//           return newRow;
//         });

//         // FIND DISCOUNT
//         const discount = await discountRepository.findOne({
//           where: {
//             route: { route_id: routeItem.route_id },
//             from_date: LessThanOrEqual(returnDate),
//             to_date: MoreThanOrEqual(returnDate),
//             is_deleted: false
//           }
//         });

//         // UPDATED PRICE AFTER DISCOUNT
//         let updatedTicketType = JSON.parse(JSON.stringify(baseTicketType));

//         if (discount) {
//           updatedTicketType = updatedTicketType.map((row: any) => {
//             const updatedRow = { ...row };
//             const discValue = Number(discount.discount_value);

//             priceColumnNames.forEach((col: string) => {
//               let price = Number(updatedRow[col]);

//               if (discount.discount_type === "decrease") {
//                 price = price - (price * discValue) / 100;
//               }

//               if (discount.discount_type === "increase") {
//                 price = price + (price * discValue) / 100;
//               }

//               if (discount.discount_type === "amount") {
//                 price = price + discValue;
//                 if (price < 0) price = 0;
//               }

//               updatedRow[col] = Number(price.toFixed(2));
//             });

//             return updatedRow;
//           });
//         }

//         return {
//           ...routeItem,
//           base_price: baseTicketType,
//           updated_base_price: updatedTicketType,
//           ticket_type_column
//         };
//       })
//     );

//     return handleSuccess(res, 200, "Return ticket types retrieved successfully", returnTicketTypes);

//   } catch (error: any) {
//     console.log(error);
//     return handleError(res, 500, "Internal Server Error");
//   }
// };

export const get_ticket_type_return_by_routeid = async (req: Request, res: Response) => {
    try {
        const ticketTypeSchema = Joi.object({
            route_id: Joi.number().required(),
            pickup_point: Joi.number().allow(null, ''),
            dropoff_point: Joi.number().allow(null, ''),
            return_date: Joi.string().required()
        });

        const { error, value } = ticketTypeSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const connection = await getConnection();
        const routeRepository = getRepository(Route);
        const routeStopsRepository = getRepository(Route_Stops);
        const currencyRepository = getRepository(CurrencyExchangeRate);
        const discountRepository = getRepository(RouteDiscount);

        const returnDate = moment(value.return_date).toDate();

        const findRoutes = await routeRepository.find({
            where: { route_id: value.route_id }
        });

        if (!findRoutes.length)
            return handleSuccess(res, 404, "No routes found for this route ID", []);

        // RETURN SWAP
        const returnPickup = value.dropoff_point;
        const returnDropoff = value.pickup_point;

        // ---- FIND CITY DETAILS ----

        const startCity = await routeStopsRepository.findOne({
            where: {
                route: { route_id: value.route_id, is_deleted: false },
                stop_city: { city_id: returnPickup }
            },
            relations: ["stop_city"]
        });

        const endCity = await routeStopsRepository.findOne({
            where: {
                route: { route_id: value.route_id, is_deleted: false },
                stop_city: { city_id: returnDropoff }
            },
            relations: ["stop_city"]
        });

        // 🟢 Detect country automatically
        const pickupCountry = Number(startCity?.stop_city?.from_ukraine) === 1 ? "Ukraine" : "Austria";
        const dropoffCountry = Number(endCity?.stop_city?.from_ukraine) === 1 ? "Ukraine" : "Austria";

        // 🟢 Exchange rule: Only Ukraine → Austria
        let applyExchange = pickupCountry === "Ukraine" && dropoffCountry === "Austria";

        // Fetch exchange rate if required
        let exchangeRate = 1;
        if (applyExchange) {
            const currencyData = await currencyRepository.findOne({
                where: { from_currency: "EUR", to_currency: "UAH" }
            });
            if (currencyData) exchangeRate = Number(currencyData.rate) || 1;
        }

        // PROCESS TICKET TYPES
        const returnTicketTypes = await Promise.all(
            findRoutes.map(async (routeItem: any) => {
                let ticket_type;
                if (!returnPickup || !returnDropoff) {
                    ticket_type = await connection.query(`
            SELECT tt.*, start_city.city_name AS start_city_name, end_city.city_name AS end_city_name
            FROM ticket_type tt
            LEFT JOIN city start_city ON start_city.city_id = tt.startPointCityId
            LEFT JOIN city end_city ON end_city.city_id = tt.endPointCityId
            WHERE tt.routeRouteId = ${routeItem.route_id}
            ORDER BY startPointCityId, endPointCityId ASC;
          `);
                } else {
                    ticket_type = await connection.query(`
            SELECT tt.*, start_city.city_name AS start_city_name, end_city.city_name AS end_city_name
            FROM ticket_type tt
            LEFT JOIN city start_city ON start_city.city_id = tt.startPointCityId
            LEFT JOIN city end_city ON end_city.city_id = tt.endPointCityId
            WHERE 
              tt.routeRouteId = ${routeItem.route_id}
              AND tt.startPointCityId = ${returnPickup}
              AND tt.endPointCityId = ${returnDropoff}
            ORDER BY startPointCityId, endPointCityId ASC;
          `);
                }

                const ticket_type_column = await connection.query(`
          SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = 'ticket_type'
            AND COLUMN_NAME NOT IN 
            ('ticket_type_id','is_active','is_deleted','created_at','updated_at','routeRouteId','startPointCityId','endPointCityId')
        `);

                const priceColumnNames = ticket_type_column.map((c: any) => c.COLUMN_NAME);

                // ---- APPLY EXCHANGE ----
                let baseTicketType = ticket_type.map((row: any) => {
                    const item = { ...row };

                    priceColumnNames.forEach((col: string) => {
                        if (item[col] !== null && !isNaN(item[col])) {
                            item[col] = Number(item[col]) * exchangeRate;
                        }
                    });

                    // swap for return
                    [item.startPointCityId, item.endPointCityId] =
                        [item.endPointCityId, item.startPointCityId];

                    [item.start_city_name, item.end_city_name] =
                        [item.end_city_name, item.start_city_name];

                    return item;
                });

                // ---- APPLY DISCOUNT ----
                const discount = await discountRepository.findOne({
                    where: {
                        route: { route_id: routeItem.route_id },
                        from_date: LessThanOrEqual(returnDate),
                        to_date: MoreThanOrEqual(returnDate),
                        is_deleted: false
                    }
                });

                let updatedTicketType = JSON.parse(JSON.stringify(baseTicketType));

                if (discount) {
                    updatedTicketType = updatedTicketType.map((row: any) => {
                        const updated = { ...row };
                        const discValue = Number(discount.discount_value);

                        priceColumnNames.forEach((col: string) => {
                            let price = Number(updated[col]);

                            if (discount.discount_type === "decrease")
                                price = price - (price * discValue) / 100;

                            if (discount.discount_type === "increase")
                                price = price + (price * discValue) / 100;

                            if (discount.discount_type === "amount") {
                                price += discValue;
                                if (price < 0) price = 0;
                            }

                            updated[col] = Number(price.toFixed(2));
                        });

                        return updated;
                    });
                }

                return {
                    ...routeItem,
                    base_price: baseTicketType,
                    updated_base_price: updatedTicketType,
                    ticket_type_column
                };
            })
        );

        return handleSuccess(res, 200, "Return ticket types retrieved successfully", returnTicketTypes);
    } catch (error: any) {
        console.log(error);
        return handleError(res, 500, "Internal Server Error");
    }
};

export const get_ticket_type_by_routeid = async (req: Request, res: Response) => {
    try {
        const ticketTypeSchema = Joi.object({
            route_id: Joi.number().required(),
            pickup_point: Joi.number().allow(null, ''),
            dropoff_point: Joi.number().allow(null, ''),
            travel_date: Joi.string().required()
        });

        const { error, value } = ticketTypeSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const connection = await getConnection();
        const routeRepository = getRepository(Route);
        const routeStopsRepository = getRepository(Route_Stops);
        const currencyExchangeRepository = getRepository(CurrencyExchangeRate);
        const discountRepository = getRepository(RouteDiscount);

        const travelDate = moment(value.travel_date).toDate();

        // ROUTE EXIST CHECK
        const findRoutes = await routeRepository.find({
            where: { route_id: value.route_id }
        });

        if (!findRoutes.length)
            return handleSuccess(res, 404, "No routes found for this route ID", []);

        // PICKUP STOP - CHECK EXCHANGE RATE
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
                where: { from_currency: "EUR", to_currency: "UAH" }
            });
            if (currencyData) exchangeRate = Number(currencyData.rate) || 1;
        }

        const newTicketTypes = await Promise.all(
            findRoutes.map(async (routeItem: any) => {

                // FETCH TICKET TYPE
                let ticket_type;
                if (!value.pickup_point || !value.dropoff_point) {
                    ticket_type = await connection.query(`
            SELECT tt.*, 
              start_city.city_name AS start_city_name,
              end_city.city_name AS end_city_name
            FROM ticket_type tt
            LEFT JOIN city start_city ON start_city.city_id = tt.startPointCityId
            LEFT JOIN city end_city ON end_city.city_id = tt.endPointCityId
            WHERE tt.routeRouteId = ${routeItem.route_id}
            ORDER BY startPointCityId, endPointCityId ASC;
          `);
                } else {
                    ticket_type = await connection.query(`
            SELECT tt.*, 
              start_city.city_name AS start_city_name,
              end_city.city_name AS end_city_name
            FROM ticket_type tt
            LEFT JOIN city start_city ON start_city.city_id = tt.startPointCityId
            LEFT JOIN city end_city ON end_city.city_id = tt.endPointCityId
            WHERE 
              tt.routeRouteId = ${routeItem.route_id}
              AND tt.startPointCityId = ${value.pickup_point}
              AND tt.endPointCityId = ${value.dropoff_point}
            ORDER BY startPointCityId, endPointCityId ASC;
          `);
                }

                // GET ALL PRICE COLUMNS DYNAMICALLY
                const ticket_type_column = await connection.query(`
          SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = 'ticket_type'
            AND COLUMN_NAME NOT IN 
              ('ticket_type_id','is_active','is_deleted','created_at','updated_at','routeRouteId','startPointCityId','endPointCityId')
        `);

                const priceColumnNames = ticket_type_column.map((c: any) => c.COLUMN_NAME);

                // BASE PRICE BEFORE DISCOUNT
                let baseTicketType = ticket_type.map((row: any) => {
                    const newRow = { ...row };
                    priceColumnNames.forEach((col: string) => {
                        if (newRow[col] !== null && !isNaN(newRow[col])) {
                            newRow[col] = Number(newRow[col]) * exchangeRate;
                        }
                    });
                    return newRow;
                });

                // FIND DISCOUNT
                const discount = await discountRepository.findOne({
                    where: {
                        route: { route_id: routeItem.route_id },
                        from_date: LessThanOrEqual(travelDate),
                        to_date: MoreThanOrEqual(travelDate),
                        is_deleted: false
                    }
                });

                // UPDATED PRICE AFTER DISCOUNT (same logic as bus_search)
                let updatedTicketType = JSON.parse(JSON.stringify(baseTicketType));

                if (discount) {
                    updatedTicketType = updatedTicketType.map((row: any) => {
                        const updatedRow = { ...row };
                        const discValue = Number(discount.discount_value);

                        priceColumnNames.forEach((col: string) => {
                            let price = Number(updatedRow[col]);

                            if (discount.discount_type === "decrease") {
                                price = price - (price * discValue) / 100;
                            }

                            if (discount.discount_type === "increase") {
                                price = price + (price * discValue) / 100;
                            }

                            if (discount.discount_type === "amount") {
                                price = price + discValue;
                                if (price < 0) price = 0;
                            }

                            updatedRow[col] = Number(price.toFixed(2));
                        });

                        return updatedRow;
                    });
                }

                return {
                    ...routeItem,
                    base_price: baseTicketType,          // Before discount
                    updated_base_price: updatedTicketType, // After discount
                    ticket_type_column
                };
            })
        );

        return handleSuccess(res, 200, "Ticket types retrieved successfully", newTicketTypes);

    } catch (error: any) {
        console.log(error);
        return handleError(res, 500, "Internal Server Error");
    }
};


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