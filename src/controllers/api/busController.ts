import Joi from "joi";
import { Request, Response } from "express";
import { getRepository, In, IsNull, LessThanOrEqual, MoreThanOrEqual, Not } from 'typeorm';
import moment from 'moment';
import { BusSchedule } from "../../entities/BusSchedule";
import { handleSuccess, handleError, joiErrorHandle } from "../../utils/responseHandler";
import { getConnection } from 'typeorm';
import { TicketType } from "../../entities/TicketType";
import { RouteClosure } from "../../entities/RouteClosure";
import { Route_Stops } from "../../entities/RouteStop";
import { Booking } from "../../entities/Booking";
import { BookingPassenger } from "../../entities/BookingPassenger";
import { CurrencyExchangeRate } from "../../entities/currency_exchange_rate";
import { RouteDiscount } from "../../entities/RouteDiscount";

export interface BusScheduleWithTicketType extends BusSchedule {
  ticket_type: TicketType[];
}


interface BusScheduleResult {
  schedule_id: number;
  recurrence_pattern: string;
  days_of_week: string[];
  departure_time: string;
  arrival_time: string;
  duration: string;
  base_price: Record<string, any> | null;
  updated_base_price: Record<string, any> | null;
  route_stops: Record<string, any>[];
  pickupStop: Record<string, any> | null;
  dropoffStop: Record<string, any> | null;
  total_booked_seats: number;
  travel_date: string;
  Return?: boolean;
}

// export const bus_search = async (req: Request, res: Response) => {
//     try {
//         const createBusSchema = Joi.object({
//             pickup_point: Joi.string().required(),
//             dropoff_point: Joi.string().required(),
//             travel_date: Joi.string().required(),
//         });

//         const { error, value } = createBusSchema.validate(req.body);
//         if (error) return joiErrorHandle(res, error);

//         const { pickup_point, dropoff_point, travel_date } = value;

//         const connection = await getConnection();
//         const busScheduleRepository = getRepository(BusSchedule);
//         const routeClosureRepository = getRepository(RouteClosure);
//         const routeStopsRepository = getRepository(Route_Stops);
//         const bookingRepository = getRepository(Booking);
//         const bookingPassengerRepository = getRepository(BookingPassenger);
//         const currencyExchangeRepository = getRepository(CurrencyExchangeRate);
//         const routeDiscountRepository = getRepository(RouteDiscount);

//         const matchingCityPickupDropPoint = await connection.query(
//             'SELECT * FROM ticket_type WHERE startPointCityId = ? AND endPointCityId = ? AND is_active = 1',
//             [pickup_point, dropoff_point]
//         );

//         if (!Array.isArray(matchingCityPickupDropPoint) || !matchingCityPickupDropPoint.length)
//             return handleError(res, 200, 'No routes/lines available.');

//         const travelDate = moment(travel_date);
//         const weekday = travelDate.format('dddd');


//         const allBusesForRoutes: BusSchedule[] = await busScheduleRepository.find({
//             where: {
//                 route: In(matchingCityPickupDropPoint.filter((route: any) => route.Baseprice != null).map((route: any) => route.routeRouteId))
//             },
//             relations: ['bus', 'route'],
//         });


//         //         const allBusesForRoutes = await busScheduleRepository.find({
//         //     where: {
//         //         route: In(
//         //             matchingCityPickupDropPoint
//         //                 .filter((r: any) => r.Baseprice != null && r.is_deleted === 0 && r.is_active === 1) // ✅ ensures price must exist
//         //                 .map((r: any) => r.routeRouteId)
//         //         )
//         //     },
//         //     relations: ['bus', 'route'],
//         // });


//         const closedRoutes = await routeClosureRepository.find({
//             where: {
//                 route: In(matchingCityPickupDropPoint.map((r: any) => r.routeRouteId)),
//                 from_date: LessThanOrEqual(travelDate.toDate()),
//                 to_date: MoreThanOrEqual(travelDate.toDate())
//             },
//             relations: ['route']
//         });

//         const closedRouteIds = closedRoutes.map(r => r.route.route_id);
//         const busesForSelectedDate: BusScheduleResult[] = [];

//         const priceRegex = /^\d+(\.\d{1,2})?$/;

//         for (const bus of allBusesForRoutes) {
//             if (closedRouteIds.includes(bus.route.route_id)) continue;

//             let isBusAvailable = bus.available ?? true;
//             if (!bus.available && bus.from && bus.to) {
//                 isBusAvailable = moment(travelDate).isBetween(moment(bus.from), moment(bus.to), 'day', '[]');
//             }
//             if (!isBusAvailable) continue;

//             if (
//                 bus.recurrence_pattern === 'Daily' ||
//                 (bus.recurrence_pattern === 'Weekly' && Array.isArray(bus.days_of_week) && bus.days_of_week.includes(weekday)) ||
//                 (bus.recurrence_pattern === 'Custom' && Array.isArray(bus.days_of_week) && bus.days_of_week.includes(weekday))
//             ) {
//                 const getAllBooking = await bookingRepository.find({
//                     where: {
//                         from: { city_id: pickup_point },
//                         to: { city_id: dropoff_point },
//                         route: { route_id: bus.route.route_id },
//                         travel_date,
//                         is_deleted: false
//                     }
//                 });

//                 const bookingPassengers = await Promise.all(
//                     (getAllBooking ?? []).map(async (booking) => {
//                         const passengers = await bookingPassengerRepository.find({
//                             where: { booking: { id: booking.id }, selected_seat: Not(IsNull()) }
//                         });
//                         return { ...booking, passengers };
//                     })
//                 );

//                 const totalPassengers = bookingPassengers.reduce((sum, b) => sum + (b.passengers?.length ?? 0), 0);

//                 const routeStopsData = await routeStopsRepository.find({
//                     where: { route: { route_id: bus.route.route_id }, is_deleted: false },
//                     relations: ["stop_city"],
//                     order: { stop_order: "ASC" },
//                 }) ?? [];

//                 const pickupStop = await routeStopsRepository.findOne({
//                     where: { route: { route_id: bus.route.route_id }, stop_city: { city_id: pickup_point }, is_deleted: false },
//                     relations: ["stop_city"]
//                 }) ?? null;

//                 const dropoffStop = await routeStopsRepository.findOne({
//                     where: { route: { route_id: bus.route.route_id }, stop_city: { city_id: dropoff_point }, is_deleted: false },
//                     relations: ["stop_city"]
//                 }) ?? null;

//                 if (!pickupStop || !dropoffStop) continue;


//                 let exchangeRate = 1;
//                 if (pickupStop.stop_city?.from_ukraine) {
//                     const currencyData = await currencyExchangeRepository.findOne({
//                         where: { from_currency: 'EUR', to_currency: 'UAH' }
//                     });
//                     if (currencyData?.rate != null) exchangeRate = Number(currencyData.rate) || 1;
//                 }

//                 if (!pickupStop.departure_time || !dropoffStop.arrival_time) continue;

//                 const departureTime = moment(`${travel_date} ${pickupStop.departure_time}`, 'YYYY-MM-DD HH:mm');
//                 const arrivalTime = moment(`${travel_date} ${dropoffStop.arrival_time}`, 'YYYY-MM-DD HH:mm');
//                 if (arrivalTime.isBefore(departureTime)) arrivalTime.add(1, 'days');

//                 const now = moment();
//                 if (travelDate.isSame(now, 'day') && departureTime.isSameOrBefore(now)) continue;

//                 const duration = moment.duration(arrivalTime.diff(departureTime));

//                 const matchingRoute = matchingCityPickupDropPoint.find((r: any) => r.routeRouteId === bus.route.route_id) ?? null;
//                 if (!matchingRoute) continue;

//                 const basePrice = matchingRoute.Baseprice != null ? Number((matchingRoute.Baseprice * exchangeRate).toFixed(2)) : null;

//                 const discountData = await routeDiscountRepository.findOne({
//                     where: {
//                         route: { route_id: bus.route.route_id },
//                         from_date: LessThanOrEqual(travelDate.toDate()),
//                         to_date: MoreThanOrEqual(travelDate.toDate()),
//                         is_deleted: false
//                     },
//                     relations: ["route"]
//                 }) ?? null;

//                 let updatedBasePrice = matchingRoute.Baseprice != null ? { ...matchingRoute } : null;

//                 if (updatedBasePrice && basePrice != null) {
//                     const discountVal = discountData?.discount_value != null ? Number(discountData.discount_value) : null;
//                     const discountType = discountData?.discount_type ?? null;

//                     const applyPercent = (price: number, percentVal: number): number => {
//                         return Number((price + (price * percentVal) / 100).toFixed(2));
//                     };

//                     const computeNewValue = (price: number): number => {
//                         if (discountVal == null || discountType == null) return price;
//                         if (discountType === "decrease") return Number((price - (price * discountVal) / 100).toFixed(2));
//                         if (discountType === "increase") return Number((price + (price * discountVal) / 100).toFixed(2));
//                         if (discountType === "amount") return Math.max(0, Number((price + discountVal).toFixed(2)));
//                         return price;
//                     };

//                     for (const key in updatedBasePrice) {
//                         const val = updatedBasePrice[key];
//                         if (typeof val === 'string' && priceRegex.test(val)) {
//                             let priceNum = Number(val);
//                             if (discountVal !== null && discountType !== "amount") {
//                                 priceNum = computeNewValue(priceNum);
//                             } else if (discountVal !== null && discountType === "amount") {
//                                 priceNum = Number((priceNum + discountVal).toFixed(2));
//                             }
//                             updatedBasePrice[key] = priceNum.toFixed(2);
//                         }
//                     }
//                 }

//                 busesForSelectedDate.push({
//                     ...(bus as any),
//                     departure_time: departureTime.format('DD-MM-YYYY HH:mm'),
//                     arrival_time: arrivalTime.format('DD-MM-YYYY HH:mm'),
//                     duration: `${duration.hours()} hours ${duration.minutes()} minutes`,
//                     base_price: matchingRoute,
//                     updated_base_price: updatedBasePrice,
//                     route_stops: routeStopsData,
//                     pickupStop,
//                     dropoffStop,
//                     total_booked_seats: totalPassengers,
//                     travel_date: travelDate.format('DD-MM-YYYY')
//                 });
//             }
//         }

//         if (!busesForSelectedDate.length)
//             return handleError(res, 200, 'No buses available for the selected date.');

//         return handleSuccess(res, 200, 'Buses found successfully', busesForSelectedDate);

//     } catch (err: any) {
//         console.error('Error in bus_search:', err);
//         return handleError(res, 500, err.message);
//     }
// };


export const bus_search = async (req: Request, res: Response) => {
  try {
    const createBusSchema = Joi.object({
      pickup_point: Joi.string().required(),
      dropoff_point: Joi.string().required(),
      travel_date: Joi.string().required(),
      return_date: Joi.string().optional().allow(null, ""),
      isReturn: Joi.boolean().optional().default(false)
    });

    const { error, value } = createBusSchema.validate(req.body);
    if (error) return joiErrorHandle(res, error);

    const { pickup_point, dropoff_point, travel_date, return_date } = value;

    const connection = await getConnection();
    const busScheduleRepository = getRepository(BusSchedule);
    const routeClosureRepository = getRepository(RouteClosure);
    const routeStopsRepository = getRepository(Route_Stops);
    const bookingRepository = getRepository(Booking);
    const bookingPassengerRepository = getRepository(BookingPassenger);
    const currencyExchangeRepository = getRepository(CurrencyExchangeRate);
    const routeDiscountRepository = getRepository(RouteDiscount);


    // const matchingCityPickupDropPoint = await connection.query(
    //   "SELECT * FROM ticket_type WHERE startPointCityId = ? AND endPointCityId = ? AND is_active = 1 AND is_deleted = 0",
    //   [pickup_point, dropoff_point]
    // );

    const matchingCityPickupDropPoint = await connection.query(
      `SELECT * FROM ticket_type 
   WHERE 
      (startPointCityId = ? AND endPointCityId = ?) 
      OR
      (startPointCityId = ? AND endPointCityId = ?)
   AND is_active = 1 AND is_deleted = 0`,
      [pickup_point, dropoff_point, dropoff_point, pickup_point]
    );


    if (!matchingCityPickupDropPoint || matchingCityPickupDropPoint.length === 0)
      return handleError(res, 200, "No routes/lines available.");

    const travelDate = moment(travel_date);
    const weekday = travelDate.format("dddd");


    const routeIds = matchingCityPickupDropPoint.map((r: any) => r.routeRouteId);

    const allBusesForRoutes: BusSchedule[] = await busScheduleRepository.find({
      where: { route: In(routeIds) },
      relations: ["bus", "route"],
    });


    const filteredSchedules = allBusesForRoutes.filter(
      (bus) => bus.route.is_deleted === false
    );

    const closedRoutes = await routeClosureRepository.find({
      where: {
        route: In(routeIds),
        from_date: LessThanOrEqual(travelDate.toDate()),
        to_date: MoreThanOrEqual(travelDate.toDate()),
      },
      relations: ["route"],
    });

    const closedRouteIds = closedRoutes.map((rou) => rou.route.route_id);

    const busesForSelectedDate: BusScheduleResult[] = [];

    const returnBusesForDate: BusScheduleResult[] = [];

    if (return_date) {
      const swappedPickup = dropoff_point;
      const swappedDrop = pickup_point;
      const returnDate = moment(return_date);
      const returnWeekday = returnDate.format("dddd");

      const matchingReturnRoutes = await connection.query(
        "SELECT * FROM ticket_type WHERE startPointCityId = ? AND endPointCityId = ? AND is_active = 1 AND is_deleted = 0",
        [swappedPickup, swappedDrop]
      );

      const returnRouteIds = matchingReturnRoutes.map((r: any) => r.routeRouteId);

      const returnSchedules = await busScheduleRepository.find({
        where: { route: In(returnRouteIds) },
        relations: ["bus", "route"],
      });

      const filteredReturnSchedules = returnSchedules.filter(
        (bus) => bus.route.is_deleted === false
      );

      const closedReturnRoutes = await routeClosureRepository.find({
        where: {
          route: In(returnRouteIds),
          from_date: LessThanOrEqual(returnDate.toDate()),
          to_date: MoreThanOrEqual(returnDate.toDate()),
        },
        relations: ["route"],
      });

      const closedReturnIds = closedReturnRoutes.map((r) => r.route.route_id);

      for (const bus of filteredReturnSchedules) {
        if (closedReturnIds.includes(bus.route.route_id)) continue;

        let isReturnBusAvailable = false;
        if (!bus.available) {
          if (bus.from && bus.to) {
            isReturnBusAvailable = moment(returnDate).isBetween(
              moment(bus.from),
              moment(bus.to),
              "day",
              "[]"
            );
          }
        } else isReturnBusAvailable = true;

        if (!isReturnBusAvailable) continue;

        if (
          bus.recurrence_pattern === "Daily" ||
          (["Weekly", "Custom"].includes(bus.recurrence_pattern) &&
            bus.days_of_week?.includes(returnWeekday))
        ) {
          // const pickupReturnStop = await routeStopsRepository.findOne({
          //   where: {
          //     route: { route_id: bus.route.route_id, is_deleted: false },
          //     stop_city: { city_id: swappedPickup },
          //   },
          //   relations: ["stop_city"],
          // });

          // const dropoffReturnStop = await routeStopsRepository.findOne({
          //   where: {
          //     route: { route_id: bus.route.route_id, is_deleted: false },
          //     stop_city: { city_id: swappedDrop },
          //   },
          //   relations: ["stop_city"],
          // });

          const pickupReturnStop = await routeStopsRepository.findOne({
            where: {
              route: { route_id: bus.route.route_id },
              stop_city: { city_id: swappedPickup }
            },
            relations: ["route", "stop_city"],
          });


          const dropoffReturnStop = await routeStopsRepository.findOne({
            where: {
              route: { route_id: bus.route.route_id },
              stop_city: { city_id: swappedDrop }
            },
            relations: ["route", "stop_city"],
          });


          if (!pickupReturnStop || !dropoffReturnStop) continue;

          const departureReturn = moment(
            `${return_date} ${pickupReturnStop.departure_time}`,
            "YYYY-MM-DD HH:mm"
          );
          const arrivalReturn = moment(
            `${return_date} ${dropoffReturnStop.arrival_time}`,
            "YYYY-MM-DD HH:mm"
          );

          if (arrivalReturn.isBefore(departureReturn)) arrivalReturn.add(1, "day");

          const durationReturn = moment.duration(arrivalReturn.diff(departureReturn));

          const returnRecord = matchingReturnRoutes.find(
            (r: any) => r.routeRouteId === bus.route.route_id && r.is_deleted === 0
          );
          if (!returnRecord) continue;

          returnBusesForDate.push({
            ...(bus as any),
            departure_time: departureReturn.format("DD-MM-YYYY HH:mm"),
            arrival_time: arrivalReturn.format("DD-MM-YYYY HH:mm"),
            duration: `${durationReturn.hours()} hours ${durationReturn.minutes()} minutes`,
            base_price: returnRecord,
            updated_base_price: returnRecord,
            route_stops: bus.route,
            pickupStop: pickupReturnStop,
            dropoffStop: dropoffReturnStop,
            total_booked_seats: 0,
            travel_date: returnDate.format("DD-MM-YYYY"),
            Return: true
          });
        }
      }
    }


    for (const bus of filteredSchedules) {
      if (closedRouteIds.includes(bus.route.route_id)) continue;


      let isBusAvailable = false;
      if (!bus.available) {
        if (bus.from && bus.to) {
          isBusAvailable = moment(travelDate).isBetween(
            moment(bus.from),
            moment(bus.to),
            "day",
            "[]"
          );
        }
      } else {
        isBusAvailable = true;
      }

      if (!isBusAvailable) continue;

      if (
        bus.recurrence_pattern === "Daily" ||
        (["Weekly", "Custom"].includes(bus.recurrence_pattern) &&
          bus.days_of_week?.includes(weekday))
      ) {
        const bookings = await bookingRepository.find({
          where: {
            from: { city_id: pickup_point },
            to: { city_id: dropoff_point },
            route: { route_id: bus.route.route_id },
            travel_date: travel_date,
            is_deleted: false,
          },
        });

        const bookingWithPassengers = await Promise.all(
          bookings.map(async (b) => {
            const passengers = await bookingPassengerRepository.find({
              where: { booking: { id: b.id }, selected_seat: Not(IsNull()) },
            });
            return { ...b, passengers };
          })
        );

        const totalBookedSeats = bookingWithPassengers.reduce(
          (sum, b) => sum + b.passengers.length,
          0
        );

        const routeStopsData = await routeStopsRepository.find({
          where: { route: { route_id: bus.route.route_id, is_deleted: false } },
          relations: ["stop_city"],
          order: { stop_order: "ASC" },
        });

        const pickupStop = await routeStopsRepository.findOne({
          where: {
            route: { route_id: bus.route.route_id, is_deleted: false },
            stop_city: { city_id: pickup_point },
          },
          relations: ["stop_city"],
        });

        const dropoffStop = await routeStopsRepository.findOne({
          where: {
            route: { route_id: bus.route.route_id, is_deleted: false },
            stop_city: { city_id: dropoff_point },
          },
          relations: ["stop_city"],
        });

        if (!pickupStop || !dropoffStop) continue;


        let exchangeRate = 1;
        if (pickupStop?.stop_city?.from_ukraine) {
          const currencyRate = await currencyExchangeRepository.findOne({
            where: { from_currency: "EUR", to_currency: "UAH" },
          });
          if (currencyRate) {
            exchangeRate = Number(currencyRate.rate) || 1;
          }
        }

        if (!/^\d{2}:\d{2}$/.test(pickupStop.departure_time ?? "")) continue;
        if (!/^\d{2}:\d{2}$/.test(dropoffStop.arrival_time ?? "")) continue;

        const departure = moment(
          `${travel_date} ${pickupStop.departure_time}`,
          "YYYY-MM-DD HH:mm"
        );
        const arrival = moment(
          `${travel_date} ${dropoffStop.arrival_time}`,
          "YYYY-MM-DD HH:mm"
        );

        if (arrival.isBefore(departure)) arrival.add(1, "day");

        const now = moment();
        if (travelDate.isSame(now, "day") && departure.isSameOrBefore(now)) continue;

        const duration = moment.duration(arrival.diff(departure));

        const matchingRoute = matchingCityPickupDropPoint.find(
          (r: any) => r.routeRouteId === bus.route.route_id && r.is_deleted === 0
        );
        if (!matchingRoute) continue;

        const routeRecord = { ...matchingRoute };

        const discountData = await routeDiscountRepository.findOne({
          where: {
            route: { route_id: bus.route.route_id },
            from_date: LessThanOrEqual(travelDate.toDate()),
            to_date: MoreThanOrEqual(travelDate.toDate()),
            is_deleted: false,
          },
          relations: ["route"],
        });

        const updatedRecord = { ...routeRecord };

        if (discountData && discountData.discount_value != null) {
          const discValue = Number(discountData.discount_value);


          for (const key of ["Baseprice", "Adult", "Child", "mesto"] as const) {
            if (updatedRecord[key] != null) {
              let price = Number(
                (updatedRecord[key] * exchangeRate).toFixed(2)
              );

              if (discountData.discount_type === "decrease") {
                price = Number((price - (price * discValue) / 100).toFixed(2));
              }

              if (discountData.discount_type === "increase") {
                price = Number((price + (price * discValue) / 100).toFixed(2));
              }

              if (discountData.discount_type === "amount") {
                price = Number((price + discValue).toFixed(2));
                if (price < 0) price = 0;
              }

              updatedRecord[key] = price;
            }
          }
        }

        busesForSelectedDate.push({
          ...(bus as any),
          departure_time: departure.format("DD-MM-YYYY HH:mm"),
          arrival_time: arrival.format("DD-MM-YYYY HH:mm"),
          duration: `${duration.hours()} hours ${duration.minutes()} minutes`,
          base_price: routeRecord,
          updated_base_price: updatedRecord,
          route_stops: routeStopsData,
          pickupStop: pickupStop,
          dropoffStop: dropoffStop,
          total_booked_seats: totalBookedSeats,
          travel_date: travelDate.format("DD-MM-YYYY"),
        });
      }
    }

    if (!busesForSelectedDate.length)
      return handleError(res, 200, "No buses available for the selected date.");

    return handleSuccess(res, 200, "Buses found successfully.", {
      onward: busesForSelectedDate,
      return: returnBusesForDate
    });


  } catch (err: any) {
    console.error("Error in bus_search:", err);
    return handleError(res, 500, err.message);
  }
};

