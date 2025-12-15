import Joi, { not } from "joi";
import path from "path";
import ejs, { name } from "ejs";
import { Request, Response } from "express";
import { Between, getRepository, Like, Not, Or, MoreThanOrEqual, LessThan } from "typeorm";
import { Booking } from "../../entities/Booking";
import { BookingPassenger } from "../../entities/BookingPassenger";
import { handleSuccess, handleError } from "../../utils/responseHandler";
import { IUser } from "../../models/User";
import { sendEmail } from "../../services/otpService";
import { generateBookingNumber, generateTransactionNumber, convertToMatchFormat } from "../../utils/function";
import moment from "moment";
import { Transaction } from "../../entities/Transaction";


export const create_booking = async (req: Request, res: Response) => {
  try {
    // ---------- JOI VALIDATION ----------
    const bookingSchema = Joi.object({
      route: Joi.string().required(),
      route_name: Joi.string().required(),
      from: Joi.string().required(),
      from_city: Joi.string().required(),
      // from_ukraine: Joi.required().allow(true, false),
      to: Joi.string().required(),
      to_city: Joi.string().required(),
      travel_date: Joi.string().isoDate().required(),
      departure_time: Joi.string().required(),
      arrival_time: Joi.string().required(),
      payment_method: Joi.string().required(),
      subtotal: Joi.number().precision(2).required(),
      tax: Joi.number().precision(2).required(),
      total: Joi.number().precision(2).required(),
      deposit: Joi.number().precision(2).required(),
      ticket_details: Joi.string().required(),
      first_name: Joi.string().required(),
      last_name: Joi.string().required(),
      phone: Joi.string().required(),
      email: Joi.string().email().required(),
      notes: Joi.string().allow("", null),

      is_return: Joi.boolean().required(),

      return_data: Joi.alternatives()
        .try(
          Joi.object({
            route: Joi.string().required(),
            from: Joi.string().required(),
            to: Joi.string().required(),
            travel_date: Joi.string().isoDate().required(),
            departure_time: Joi.string().required(),
            arrival_time: Joi.string().required(),
            ticket_details: Joi.string().required(),
            subtotal: Joi.number().required(),
            tax: Joi.number().required(),
            total: Joi.number().required(),
            deposit: Joi.number().required()
          }),
          Joi.string() // allow string → convert to JSON
        )
        .when("is_return", { is: true, then: Joi.required() }),
    });

    const { error, value } = bookingSchema.validate(req.body);
    if (error) return handleError(res, 400, error.details[0].message);

    // Extract  
    let {
      route,
      route_name,
      from,
      from_city,
      from_ukraine,
      to,
      to_city,
      travel_date,
      departure_time,
      arrival_time,
      payment_method,
      subtotal,
      tax,
      total,
      deposit,
      ticket_details,
      first_name,
      last_name,
      phone,
      email,
      notes,
      is_return,
      return_data
    } = value;

    // ---------- RETURN_DATA STRING → OBJECT CONVERSION ----------
    if (is_return && typeof return_data === "string") {
      try {
        return_data = JSON.parse(return_data);
      } catch (err) {
        return handleError(res, 400, "Invalid JSON format in return_data");
      }
    }

    const user_req = req.user as IUser;

    const bookingRepository = getRepository(Booking);
    const bookingPassengerRepository = getRepository(BookingPassenger);
    const transactionRepository = getRepository(Transaction);

    // ---------- CREATE ONWARD BOOKING ----------
    const newBooking = bookingRepository.create({
      booking_number: await generateBookingNumber(moment(travel_date).format("DD-MM-YYYY")),
      parent_booking_id: null,
      trip_type: "onward",
      route,
      from,
      to,
      travel_date: moment(travel_date).format("DD-MM-YYYY"),
      departure_time,
      arrival_time,
      payment_method,
      subtotal,
      tax,
      total,
      deposit,
      first_name,
      last_name,
      phone,
      email,
      notes,
      booking_user_id: user_req.id,
      payment_status: payment_method === "Cash",
    });
    await bookingRepository.save(newBooking);

    // ---------- SAVE PASSENGERS ----------
    JSON.parse(ticket_details).map(async (p: any) => {
      await bookingPassengerRepository.save({
        booking: newBooking,
        ticket_type: p.ticketType,
        selected_seat: p.selectedSeat || null,
        passenger_name: p.passengerName,
        price: p.price
      });
    });

    // ---------- CASH PAYMENT ----------
    if (payment_method === "Cash") {
      await transactionRepository.save({
        transaction_number: await generateTransactionNumber(moment(travel_date).format("DD-MM-YYYY")),
        booking: newBooking,
        user: user_req.id,
        amount: Number(total),
        amount_paid: Number(deposit),
        currency: "eur",
        payment_method: "cash",
        payment_type: "Cash",
        status: "completed",
        external_transaction_id: "unknown",
        description: "Bus ticket payment",
        payment_details: null,
      });
    }

    // ---------- RETURN BOOKING ----------
    let returnBooking: any = null;

    if (is_return) {
      const rd = return_data;

      returnBooking = bookingRepository.create({
        booking_number: await generateBookingNumber(moment(rd.travel_date).format("DD-MM-YYYY")),
        parent_booking_id: newBooking.id,
        trip_type: "return",
        route: rd.route,
        from: rd.from,
        to: rd.to,
        travel_date: moment(rd.travel_date).format("DD-MM-YYYY"),
        departure_time: rd.departure_time,
        arrival_time: rd.arrival_time,
        subtotal: rd.subtotal,
        tax: rd.tax,
        total: rd.total,
        deposit: rd.deposit,
        first_name,
        last_name,
        phone,
        email,
        notes,
        booking_user_id: user_req.id,
        payment_status: payment_method === "Cash",
      });
      await bookingRepository.save(returnBooking);

      // PASSENGERS
      for (let p of rd.ticket_details) {
        await bookingPassengerRepository.save({
          booking: returnBooking,
          ticket_type: p.ticketType,
          selected_seat: p.selectedSeat || null,
          passenger_name: p.passengerName,
          price: p.price
        });
      }

      // CASH TRANSACTION FOR RETURN
      if (payment_method === "Cash") {
        await transactionRepository.save({
          transaction_number: await generateTransactionNumber(moment(rd.travel_date).format("DD-MM-YYYY")),
          booking: returnBooking,
          user: user_req.id,
          amount: Number(rd.total),
          amount_paid: Number(rd.deposit),
          currency: "eur",
          payment_method: "cash",
          payment_type: "Cash",
          status: "completed",
          external_transaction_id: "unknown",
          description: "Bus ticket payment",
          payment_details: null,
        });
      }
    }

    // ---------- SEND EMAIL ----------
    const emailTemplatePath = path.resolve(__dirname, "../../views/booking.ejs");

    const emailHtml = await ejs.renderFile(emailTemplatePath, {
      bookingNumber: newBooking.booking_number,
      returnTrip: returnBooking ? returnBooking.booking_number : null,
      first_name,
      last_name,
      email,
      phone,
      total: from_ukraine == "true" ? total + "₴" : total + "€",
      departure_time,
      arrival_time,
      payment_method,
      route_name,
      from_city,
      to_city
    });

    await sendEmail({
      to: email,
      subject: "Your Ticket Has Been Successfully Booked",
      html: emailHtml,
    });

    return handleSuccess(res, 201, "Your ticket has been booked successfully", {
      onward: newBooking,
      return: returnBooking
    });

  } catch (error: any) {
    console.error("Error in create booking:", error);
    return handleError(res, 500, error.message);
  }
};

export const getUpcommingTicketBookingTransactionsByUserId = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const pageNumber = parseInt(page as string, 10);
    const pageLimit = parseInt(limit as string, 10);
    const offset = (pageNumber - 1) * pageLimit;

    const user_req = req.user as IUser;
    const bookingRepository = getRepository(Booking);


    const allBookings = await bookingRepository.find({
      where: { booking_user_id: user_req.id, payment_status: true, travel_date: MoreThanOrEqual(moment().startOf("day").format("YYYY-MM-DD")) },
      relations: ["from", "to", "route"],
      order: { created_at: "DESC" },
    });

    const searchLower = search.toString().toLowerCase();

    const filtered = search
      ? allBookings.filter((booking) =>
        booking.first_name?.toLowerCase().includes(searchLower) ||
        booking.last_name?.toLowerCase().includes(searchLower) ||
        booking.phone?.toLowerCase().includes(searchLower) ||
        booking.email?.toLowerCase().includes(searchLower)
      )
      : allBookings;

    const bookingsWithDuration = filtered.map((booking) => {
      const departureTime = convertToMatchFormat(booking.departure_time); // booking.departure_time;
      const arrivalTime = convertToMatchFormat(booking.arrival_time); // booking.arrival_time;

      if (typeof departureTime !== 'string' || typeof arrivalTime !== 'string') {
        return {
          ...booking,
          duration: 'Invalid time format',
        };
      }

      const departure = moment(departureTime, "YYYY-MM-DD HH:mm", true);
      const arrival = moment(arrivalTime, "YYYY-MM-DD HH:mm", true);

      if (!departure.isValid() || !arrival.isValid()) {
        return {
          ...booking,
          duration: 'Invalid time',
        };
      }

      const duration = moment.duration(arrival.diff(departure));

      const hours = duration.hours();
      const minutes = duration.minutes();

      return {
        ...booking,
        duration: `${hours} hours ${minutes} minutes`,
      };
    });

    const paginated = bookingsWithDuration.slice(offset, offset + pageLimit);
    const totalFiltered = bookingsWithDuration.length;
    const totalPages = Math.ceil(totalFiltered / pageLimit);

    return handleSuccess(res, 200, "Upcomming booking fetched successfully.", {
      data: paginated,
      pagination: {
        total: totalFiltered,
        totalPages,
        currentPage: pageNumber,
        pageSize: pageLimit,
      },
    });
  } catch (error: any) {
    return handleError(res, 500, error.message);
  }
};

export const getPastTicketBookingTransactionsByUserId = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const pageNumber = parseInt(page as string, 10);
    const pageLimit = parseInt(limit as string, 10);
    const offset = (pageNumber - 1) * pageLimit;

    const user_req = req.user as IUser;
    const bookingRepository = getRepository(Booking);

    const allBookings = await bookingRepository.find({
      where: { booking_user_id: user_req.id, payment_status: true, travel_date: LessThan(moment().startOf("day").format("YYYY-MM-DD")) },
      relations: ["from", "to", "route"],
    });

    const searchLower = search.toString().toLowerCase();

    const filtered = search
      ? allBookings.filter((booking) =>
        booking.first_name?.toLowerCase().includes(searchLower) ||
        booking.last_name?.toLowerCase().includes(searchLower) ||
        booking.phone?.toLowerCase().includes(searchLower) ||
        booking.email?.toLowerCase().includes(searchLower)
      )
      : allBookings;

    const bookingsWithDuration = filtered.map((booking) => {
      const departureTime = booking.departure_time;
      const arrivalTime = booking.arrival_time;

      if (typeof departureTime !== 'string' || typeof arrivalTime !== 'string') {
        return {
          ...booking,
          duration: 'Invalid time format',
        };
      }

      const departure = moment(departureTime, "YYYY-MM-DD HH:mm", true);
      const arrival = moment(arrivalTime, "YYYY-MM-DD HH:mm", true);

      if (!departure.isValid() || !arrival.isValid()) {
        return {
          ...booking,
          duration: 'Invalid time',
        };
      }

      const duration = moment.duration(arrival.diff(departure));

      const hours = duration.hours();
      const minutes = duration.minutes();

      return {
        ...booking,
        duration: `${hours} hours ${minutes} minutes`,
      };
    });

    const paginated = bookingsWithDuration.slice(offset, offset + pageLimit);
    const totalFiltered = bookingsWithDuration.length;
    const totalPages = Math.ceil(totalFiltered / pageLimit);

    return handleSuccess(res, 200, "Past booking fetched successfully.", {
      data: paginated,
      pagination: {
        total: totalFiltered,
        totalPages,
        currentPage: pageNumber,
        pageSize: pageLimit,
      },
    });
  } catch (error: any) {
    return handleError(res, 500, error.message);
  }
};

export const getTicketBookingByBookingId = async (req: Request, res: Response) => {
  try {
    const bookingSchema = Joi.object({
      id: Joi.number().required(),
    });

    const { error, value } = bookingSchema.validate(req.query);
    if (error) return handleError(res, 400, error.details[0].message);

    const bookingRepository = getRepository(Booking);
    const bookingPassengerRepository = getRepository(BookingPassenger);
    const transactionRepository = getRepository(Transaction);

    const { id } = value;

    const getAllBooking = await bookingRepository.find({
      where: { id, is_deleted: false, payment_status: true },
      relations: ["from", "to", "route"],
    });

    if (!getAllBooking.length)
      return handleError(res, 404, "Booking not found");

    const transactionRes = await Promise.all(
      getAllBooking.map(async (booking) => {
        const transaction = await transactionRepository.find({
          where: { booking: { id: booking.id } },
        });
        return { ...booking, transaction };
      })
    )

    const bookingPassengers = await Promise.all(
      transactionRes.map(async (product) => {
        const passengers = await bookingPassengerRepository.find({
          where: { booking: { id: product.id } },
        });
        return { ...product, passengers };
      })
    );

    return handleSuccess(res, 200, "Get Ticket Booking", bookingPassengers);
  } catch (error: any) {
    console.error("Error in create booking:", error);
    return handleError(res, 500, error.message);
  }
};


// export const bus_search = async (req: Request, res: Response) => {
//   try {
//     const createBusSchema = Joi.object({
//       pickup_point: Joi.string().required(),
//       dropoff_point: Joi.string().required(),
//       travel_date: Joi.string().required(),
//       return_date: Joi.string().optional(),
//     });

//     const { error, value } = createBusSchema.validate(req.body);
//     if (error) return joiErrorHandle(res, error);

//     const { pickup_point, dropoff_point, travel_date, return_date } = value;

//     const connection = await getConnection();
//     const busScheduleRepository = getRepository(BusSchedule);
//     const routeClosureRepository = getRepository(RouteClosure);
//     const routeStopsRepository = getRepository(Route_Stops);
//     const bookingRepository = getRepository(Booking);
//     const bookingPassengerRepository = getRepository(BookingPassenger);
//     const currencyExchangeRepository = getRepository(CurrencyExchangeRate);
//     const routeDiscountRepository = getRepository(RouteDiscount);

//     // ✅ Keep old query but filter deleted routes too
//     const matchingCityPickupDropPoint = await connection.query(
//       "SELECT * FROM ticket_type WHERE startPointCityId = ? AND endPointCityId = ? AND is_active = 1 AND is_deleted = 0",
//       [pickup_point, dropoff_point]
//     );

//     if (!matchingCityPickupDropPoint || matchingCityPickupDropPoint.length === 0)
//       return handleError(res, 200, "No routes/lines available.");

//     const travelDate = moment(travel_date);
//     const weekday = travelDate.format("dddd");

//     // ✅ Fetch schedules only for priced and non-deleted routes
//     const routeIds = matchingCityPickupDropPoint.map((r: any) => r.routeRouteId);

//     const allBusesForRoutes: BusSchedule[] = await busScheduleRepository.find({
//       where: { route: In(routeIds) },
//       relations: ["bus", "route"],
//     });

//     // ✅ Remove schedules where related route is deleted (like your old version)
//     const filteredSchedules = allBusesForRoutes.filter(
//       (bus) => bus.route.is_deleted === false
//     );

//     const closedRoutes = await routeClosureRepository.find({
//       where: {
//         route: In(routeIds),
//         from_date: LessThanOrEqual(travelDate.toDate()),
//         to_date: MoreThanOrEqual(travelDate.toDate()),
//       },
//       relations: ["route"],
//     });

//     const closedRouteIds = closedRoutes.map((rou) => rou.route.route_id);

//     const busesForSelectedDate: BusScheduleResult[] = [];

//     // ==================== ✅ RETURN BUS SEARCH (Dynamic reverse, NO DB insert) ====================
//     const returnBusesForDate: BusScheduleResult[] = [];

//     if (return_date) {
//       const returnDate = moment(return_date);
//       const returnWeekday = returnDate.format("dddd");

//       // Use the same table but swap pickup/dropoff in the WHERE clause
//       const returnTicketTypes = await connection.query(
//         `SELECT * FROM ticket_type
//          WHERE startPointCityId  = ? AND endPointCityId  = ?
//            AND is_active = 1 AND is_deleted = 0`,
//         [dropoff_point, pickup_point] // just swap points here
//       );

//       const returnRouteIds = returnTicketTypes.map((r: any) => r.routeRouteId);

//       const returnSchedules = await busScheduleRepository.find({
//         where: { route: In(returnRouteIds) },
//         relations: ["bus", "route"]
//       });

//       const filteredReturnSchedules = returnSchedules.filter(bus => bus.route.is_deleted === false);

//       for (const bus of filteredReturnSchedules) {
//         // skip closed routes
//         const closures = await routeClosureRepository.find({
//           where: {
//             route: { route_id: bus.route.route_id },
//             from_date: LessThanOrEqual(returnDate.toDate()),
//             to_date: MoreThanOrEqual(returnDate.toDate())
//           },
//           relations: ["route"]
//         });
//         if (closures.length > 0) continue;

//         // recurrence & availability checks
//         let isBusAvailable = bus.available === true;
//         if (!bus.available && bus.from && bus.to) {
//           isBusAvailable = returnDate.isBetween(moment(bus.from), moment(bus.to), "day", "[]");
//         }
//         if (!isBusAvailable) continue;

//         if (
//           bus.recurrence_pattern === "Daily" ||
//           (["Weekly", "Custom"].includes(bus.recurrence_pattern) &&
//             bus.days_of_week?.includes(returnWeekday))
//         ) {
//           // swap pickup/dropoff dynamically
//           const pickupStop = await routeStopsRepository.findOne({
//             where: {
//               route: { route_id: bus.route.route_id, is_deleted: false },
//               stop_city: { city_id: dropoff_point } // swapped
//             },
//             relations: ["stop_city"]
//           });

//           const dropoffStop = await routeStopsRepository.findOne({
//             where: {
//               route: { route_id: bus.route.route_id, is_deleted: false },
//               stop_city: { city_id: pickup_point } // swapped
//             },
//             relations: ["stop_city"]
//           });

//           if (!pickupStop || !dropoffStop) continue;

//           const departureReturn = moment(`${return_date} ${pickupStop.departure_time}`, "YYYY-MM-DD HH:mm");
//           const arrivalReturn = moment(`${return_date} ${dropoffStop.arrival_time}`, "YYYY-MM-DD HH:mm");
//           if (arrivalReturn.isBefore(departureReturn)) arrivalReturn.add(1, "day");

//           returnBusesForDate.push({
//             schedule_id: bus.schedule_id,
//             recurrence_pattern: bus.recurrence_pattern,
//             days_of_week: Array.isArray(bus.days_of_week) ? bus.days_of_week : bus.days_of_week?.split(",") || [],
//             departure_time: departureReturn.format("DD-MM-YYYY HH:mm"),
//             arrival_time: arrivalReturn.format("DD-MM-YYYY HH:mm"),
//             duration: moment.duration(arrivalReturn.diff(departureReturn)).humanize(),
//             base_price: returnTicketTypes.find((r: any) => r.routeRouteId === bus.route.route_id) || null,
//             updated_base_price: returnTicketTypes.find((r: any) => r.routeRouteId === bus.route.route_id) || null,
//             pickupStop,
//             dropoffStop,
//             route_stops: await routeStopsRepository.find({
//               where: { route: { route_id: bus.route.route_id, is_deleted: false } },
//               relations: ["stop_city"],
//               order: { stop_order: "ASC" }
//             }),
//             total_booked_seats: 0,
//             travel_date: returnDate.format("DD-MM-YYYY"),
//             Return: true
//           });
//         }
//       }
//     }

//     // ==================== ✅ RETURN BUS SEARCH END ====================


//     for (const bus of filteredSchedules) {
//       if (closedRouteIds.includes(bus.route.route_id)) continue;

//       // ✅ Keep availability logic exactly same as previous code
//       let isBusAvailable = false;
//       if (!bus.available) {
//         if (bus.from && bus.to) {
//           isBusAvailable = moment(travelDate).isBetween(
//             moment(bus.from),
//             moment(bus.to),
//             "day",
//             "[]"
//           );
//         }
//       } else {
//         isBusAvailable = true;
//       }

//       if (!isBusAvailable) continue;

//       if (
//         bus.recurrence_pattern === "Daily" ||
//         (["Weekly", "Custom"].includes(bus.recurrence_pattern) &&
//           bus.days_of_week?.includes(weekday))
//       ) {
//         const bookings = await bookingRepository.find({
//           where: {
//             from: { city_id: pickup_point },
//             to: { city_id: dropoff_point },
//             route: { route_id: bus.route.route_id },
//             travel_date: travel_date,
//             is_deleted: false,
//           },
//         });

//         const bookingWithPassengers = await Promise.all(
//           bookings.map(async (b) => {
//             const passengers = await bookingPassengerRepository.find({
//               where: { booking: { id: b.id }, selected_seat: Not(IsNull()) },
//             });
//             return { ...b, passengers };
//           })
//         );

//         const totalBookedSeats = bookingWithPassengers.reduce(
//           (sum, b) => sum + b.passengers.length,
//           0
//         );

//         const routeStopsData = await routeStopsRepository.find({
//           where: { route: { route_id: bus.route.route_id, is_deleted: false } },
//           relations: ["stop_city"],
//           order: { stop_order: "ASC" },
//         });

//         const pickupStop = await routeStopsRepository.findOne({
//           where: {
//             route: { route_id: bus.route.route_id, is_deleted: false },
//             stop_city: { city_id: pickup_point },
//           },
//           relations: ["stop_city"],
//         });

//         const dropoffStop = await routeStopsRepository.findOne({
//           where: {
//             route: { route_id: bus.route.route_id, is_deleted: false },
//             stop_city: { city_id: dropoff_point },
//           },
//           relations: ["stop_city"],
//         });

//         if (!pickupStop || !dropoffStop) continue;

//         // ✅ Keep currency logic same like previous
//         let exchangeRate = 1;
//         if (pickupStop?.stop_city?.from_ukraine) {
//           const currencyRate = await currencyExchangeRepository.findOne({
//             where: { from_currency: "EUR", to_currency: "UAH" },
//           });
//           if (currencyRate) {
//             exchangeRate = Number(currencyRate.rate) || 1;
//           }
//         }

//         if (!/^\d{2}:\d{2}$/.test(pickupStop.departure_time ?? "")) continue;
//         if (!/^\d{2}:\d{2}$/.test(dropoffStop.arrival_time ?? "")) continue;

//         const departure = moment(
//           `${travel_date} ${pickupStop.departure_time}`,
//           "YYYY-MM-DD HH:mm"
//         );
//         const arrival = moment(
//           `${travel_date} ${dropoffStop.arrival_time}`,
//           "YYYY-MM-DD HH:mm"
//         );

//         if (arrival.isBefore(departure)) arrival.add(1, "day");

//         const now = moment();
//         if (travelDate.isSame(now, "day") && departure.isSameOrBefore(now)) continue;

//         const duration = moment.duration(arrival.diff(departure));

//         const matchingRoute = matchingCityPickupDropPoint.find(
//           (r: any) => r.routeRouteId === bus.route.route_id && r.is_deleted === 0
//         );
//         if (!matchingRoute) continue; // ✅ Prevent extra buses with null prices

//         // ✅ Keep base_price object same like previous
//         const routeRecord = { ...matchingRoute };

//         // ✅ ===== NEW PRICE UPDATE LOGIC START =====
//         const discountData = await routeDiscountRepository.findOne({
//           where: {
//             route: { route_id: bus.route.route_id },
//             from_date: LessThanOrEqual(travelDate.toDate()),
//             to_date: MoreThanOrEqual(travelDate.toDate()),
//             is_deleted: false,
//           },
//           relations: ["route"],
//         });

//         const updatedRecord = { ...routeRecord }; // new object like base_price

//         if (discountData && discountData.discount_value != null) {
//           const discValue = Number(discountData.discount_value);

//           // ✅ Apply same discount logic to all price keys
//           for (const key of ["Baseprice", "Adult", "Child", "mesto"] as const) {
//             if (updatedRecord[key] != null) {
//               let price = Number(
//                 (updatedRecord[key] * exchangeRate).toFixed(2)
//               );

//               if (discountData.discount_type === "decrease") {
//                 price = Number((price - (price * discValue) / 100).toFixed(2));
//               }

//               if (discountData.discount_type === "increase") {
//                 price = Number((price + (price * discValue) / 100).toFixed(2));
//               }

//               if (discountData.discount_type === "amount") {
//                 price = Number((price + discValue).toFixed(2));
//                 if (price < 0) price = 0;
//               }

//               updatedRecord[key] = price; // updated discounted price assigned
//             }
//           }
//         }

//         // ✅ Only Baseprice key used for pricing
//         // Push new object as updated_base_price
//         // ✅ ===== NEW PRICE UPDATE LOGIC END =====

//         busesForSelectedDate.push({
//           ...(bus as any),
//           departure_time: departure.format("DD-MM-YYYY HH:mm"),
//           arrival_time: arrival.format("DD-MM-YYYY HH:mm"),
//           duration: `${duration.hours()} hours ${duration.minutes()} minutes`,
//           base_price: routeRecord, // same like previous
//           updated_base_price: updatedRecord, // ✅ new object added after base_price
//           route_stops: routeStopsData,
//           pickupStop: pickupStop,
//           dropoffStop: dropoffStop,
//           total_booked_seats: totalBookedSeats,
//           travel_date: travelDate.format("DD-MM-YYYY"),
//         });
//       }
//     }

//     if (!busesForSelectedDate.length)
//       return handleError(res, 200, "No buses available for the selected date.");

//     return handleSuccess(res, 200, "Buses found successfully.", {
//       onward: busesForSelectedDate,
//       return: returnBusesForDate
//     });


//   } catch (err: any) {
//     console.error("Error in bus_search:", err);
//     return handleError(res, 500, err.message);
//   }
// };
