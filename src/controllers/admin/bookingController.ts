import Joi, { not } from "joi";
import path from "path";
import ejs, { name } from "ejs";
import { Request, Response } from "express";
import { Between, getRepository, Like, Not, Or } from "typeorm";
import { Booking } from "../../entities/Booking";
import { BookingPassenger } from "../../entities/BookingPassenger";
import { Transaction } from "../../entities/Transaction";
import { handleSuccess, handleError } from "../../utils/responseHandler";
import { IAdmin } from "../../models/Admin";
import { sendEmail } from "../../services/otpService";
import {
  generateBookingNumber,
  generateTransactionNumber,
} from "../../utils/function";
import moment from "moment";
import { CurrencyExchangeRate } from "../../entities/currency_exchange_rate";


export const create_booking = async (req: Request, res: Response) => {
  try {
    const bookingSchema = Joi.object({
      route: Joi.string().required(),
      from: Joi.string().required(),
      to: Joi.string().required(),
      from_ukraine: Joi.optional().allow(true, false),
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
      notes: Joi.string().optional().allow(null, ""),
    });

    const { error, value } = bookingSchema.validate(req.body);
    if (error) return handleError(res, 400, error.details[0].message);

    const bookingRepository = getRepository(Booking);
    const bookingPassengerRepository = getRepository(BookingPassenger);
    const transactionRepository = getRepository(Transaction);

    const {
      route,
      from,
      to,
      from_ukraine,
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
    } = value;
    const admin_req = req.admin as IAdmin;

    const newBooking = bookingRepository.create({
      booking_number: await generateBookingNumber(moment(travel_date).format("DD-MM-YYYY")),
      route: route,
      from: from,
      to: to,
      travel_date: moment(travel_date).format("DD-MM-YYYY"),
      departure_time: departure_time,
      arrival_time: arrival_time,
      payment_method: payment_method,
      subtotal: subtotal,
      tax: tax,
      total: total,
      deposit: deposit,
      first_name: first_name,
      last_name: last_name,
      phone: phone,
      email: email,
      notes: notes,
      booking_user_id: admin_req.id,
      payment_status: true,
    });
    await bookingRepository.save(newBooking);

    JSON.parse(ticket_details).map(async (passenger: any) => {
      const newPassenger = bookingPassengerRepository.create({
        booking: newBooking,
        ticket_type: passenger.ticketType,
        selected_seat: passenger.selectedSeat,
        passenger_name: passenger.passengerName,
        price: passenger.price,
      });
      await bookingPassengerRepository.save(newPassenger);
    });

    if (payment_method == "Cash") {
      const transaction = transactionRepository.create({
        transaction_number: await generateTransactionNumber(moment(travel_date).format("DD-MM-YYYY")),
        booking: newBooking,
        user: admin_req.id,
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
      await transactionRepository.save(transaction);

      const findBooking = await bookingRepository.findOne({
        where: { id: newBooking.id },
        relations: ["from", "to", "route"],
      });

      const emailTemplatePath = path.resolve(
        __dirname,
        "../../views/booking.ejs"
      );
      const emailHtml = await ejs.renderFile(emailTemplatePath, {
        bookingNumber: newBooking.booking_number,
        first_name,
        last_name,
        email,
        phone,
        total: from_ukraine == 'true' ? total + '₴' : total + '€',
        departure_time,
        arrival_time,
        payment_method,
        route_name: findBooking?.route.title,
        from_city: findBooking?.from.city_name,
        to_city: findBooking?.to.city_name,
      });

      const emailOptions = {
        to: email,
        subject: "Your Ticket Has Been Successfully Booked",
        html: emailHtml,
      };
      await sendEmail(emailOptions);
    }

    return handleSuccess(
      res,
      201,
      "Your ticket has been booked successfully",
      newBooking
    );
  } catch (error: any) {
    console.error("Error in create booking:", error);
    return handleError(res, 500, error.message);
  }
};


export const get_all_booking = async (req: Request, res: Response) => {
  try {

    const { page = 1, limit = 10, search = '' } = req.query;

    const pageNumber = parseInt(page as string, 10);
    const pageLimit = parseInt(limit as string, 10);
    const offset = (pageNumber - 1) * pageLimit;

    const bookingSchema = Joi.object({
      booking_status: Joi.string().valid("Pending", "Confirmed", "Cancelled", "").optional(),
      search: Joi.string().optional().allow(""),
      start_date: Joi.string().optional().allow(""),
      end_date: Joi.string().optional().allow(""),
      route_id: Joi.string().optional().allow(""),
    });

    const { error, value } = bookingSchema.validate(req.body);
    if (error) return handleError(res, 400, error.details[0].message);

    const { booking_status, start_date, end_date, route_id } = value;


    const bookingRepository = getRepository(Booking);
    const bookingPassengerRepository = getRepository(BookingPassenger);
    const currencyExchangeRepository = getRepository(CurrencyExchangeRate);


    const dbWhere: any = {
      is_deleted: false,
      payment_status: true,
    };

    if (booking_status) dbWhere.booking_status = booking_status;
    if (start_date && end_date) dbWhere.travel_date = Between(start_date, end_date);
    if (route_id) dbWhere.route = { route_id };


    const [bookings, total] = await bookingRepository.findAndCount({
      where: dbWhere,
      relations: ["from", "to"],
      order: { created_at: "DESC" },
      take: pageLimit,
      skip: offset,
    });


    let filteredBookings = bookings;
    if (search) {
      const lowerSearch = (search as string).toLowerCase();
      filteredBookings = filteredBookings.filter(val =>
        val?.from?.city_name?.toLowerCase().includes(lowerSearch) ||
        val?.to?.city_name?.toLowerCase().includes(lowerSearch) ||
        val?.first_name?.toLowerCase().includes(lowerSearch) ||
        val?.last_name?.toLowerCase().includes(lowerSearch) ||
        val?.email?.toLowerCase().includes(lowerSearch) ||
        val?.phone?.toLowerCase().includes(lowerSearch) ||
        val?.booking_number?.toLowerCase().includes(lowerSearch)
      );
    }


    const bookingWithPassengers = await Promise.all(
      filteredBookings.map(async (booking) => {
        const passengers = await bookingPassengerRepository.find({
          where: { booking: { id: booking.id } },
        });

        let exchangeRate = 1;
        if (booking?.from?.from_ukraine) {
          const currencyData = await currencyExchangeRepository.findOne({
            where: { from_currency: 'EUR', to_currency: 'UAH' }
          });
          exchangeRate = currencyData ? Number(currencyData.rate) || 1 : 1;
        }

        booking.subtotal = Number((booking.subtotal / exchangeRate).toFixed(2));
        booking.total = Number((booking.total / exchangeRate).toFixed(2));

        return { ...booking, passengers };
      })
    );


    const totalPages = Math.ceil(total / pageLimit);


    return handleSuccess(res, 200, "Bookings fetched successfully.", {
      bookings: bookingWithPassengers,
      pagination: {
        total,
        totalPages,
        currentPage: pageNumber,
        pageSize: pageLimit,
      }
    });

  } catch (error: any) {
    console.error("Error in get_all_booking:", error);
    return handleError(res, 500, error.message);
  }
};



// export const get_all_booking = async (req: Request, res: Response) => {
//   try {
//     const bookingSchema = Joi.object({
//       booking_status: Joi.string().valid("Pending", "Confirmed", "Cancelled", "").optional(),
//       search: Joi.string().optional().allow(""),
//       start_date: Joi.string().optional(),
//       end_date: Joi.string().optional(),
//       route_id: Joi.string().optional(),
//     });

//     const { error, value } = bookingSchema.validate(req.body);
//     if (error) return handleError(res, 400, error.details[0].message);

//     const { booking_status, search, start_date, end_date, route_id } = value;

//     const bookingRepository = getRepository(Booking);
//     const bookingPassengerRepository = getRepository(BookingPassenger);
//     const currencyExchangeRepository = getRepository(CurrencyExchangeRate);

//     const baseCondition: any = {
//       is_deleted: false,
//       payment_status: true,
//     };
//     if (booking_status) baseCondition.booking_status = booking_status;
//     if (start_date && end_date) baseCondition.travel_date = Between(start_date, end_date);
//     if (route_id) baseCondition.route = { route_id };  

//     let getAllBooking = await bookingRepository.find({
//       where: baseCondition,
//       relations: ["from", "to"],
//       order: { created_at: "DESC" },
//     });

//     if (search) {
//       const lowerSearch = search.toLowerCase();
//       getAllBooking = getAllBooking.filter(
//         val =>
//           val?.from?.city_name?.toLowerCase().includes(lowerSearch) ||
//           val?.to?.city_name?.toLowerCase().includes(lowerSearch) ||
//           val?.first_name?.toLocaleLowerCase().includes(lowerSearch) ||
//           val?.last_name?.toLocaleLowerCase().includes(lowerSearch) ||
//           val?.email?.toLocaleLowerCase().includes(lowerSearch) ||
//           val?.phone?.toLocaleLowerCase().includes(lowerSearch) ||
//           val?.booking_number?.toLocaleLowerCase().includes(lowerSearch)
//       );
//     }

//     const bookingPassengers = await Promise.all(
//       getAllBooking.map(async (product) => {
//         const passengers = await bookingPassengerRepository.find({
//           where: { booking: { id: product.id } },
//         });

//         let exchangeRate = 1;
//         if (product?.from?.from_ukraine) {
//           const currencyData = await currencyExchangeRepository.findOne({
//             where: { from_currency: 'EUR', to_currency: 'UAH' }
//           });

//           exchangeRate = currencyData ? Number(currencyData.rate) || 1 : 1;
//         }

//         product.subtotal = Number((product.subtotal / exchangeRate).toFixed(2));
//         product.total = Number((product.total / exchangeRate).toFixed(2));

//         return { ...product, passengers };
//       })
//     );

//     return handleSuccess(res, 200, "Get All Booking", bookingPassengers);
//   } catch (error: any) {
//     console.error("Error in get_all_booking:", error);
//     return handleError(res, 500, error.message);
//   }
// };


export const get_booking_by_id = async (req: Request, res: Response) => {
  try {
    const bookingSchema = Joi.object({
      booking_id: Joi.string().required(),
    });

    const { error, value } = bookingSchema.validate(req.query);
    if (error) return handleError(res, 400, error.details[0].message);

    const bookingRepository = getRepository(Booking);
    const bookingPassengerRepository = getRepository(BookingPassenger);

    const { booking_id } = value;

    const getAllBooking = await bookingRepository.findOne({
      where: { id: booking_id },
      relations: ["from", "to", "route"],
    });

    if (!getAllBooking) return handleError(res, 404, "Booking not found");

    const passengers = await bookingPassengerRepository.find({
      where: { booking: { id: getAllBooking?.id } },
    });

    return handleSuccess(res, 200, "Get Booking By Id", {
      ...getAllBooking,
      passengers,
    });
  } catch (error: any) {
    console.error("Error in get booking by id:", error);
    return handleError(res, 500, error.message);
  }
};

export const update_booking_by_id = async (req: Request, res: Response) => {
  try {
    const bookingSchema = Joi.object({
      booking_id: Joi.string().required(),
      booking_status: Joi.string()
        .valid("Pending", "Confirmed", "Cancelled")
        .required(),
      from_ukraine: Joi.required().allow(true, false),
      payment_method: Joi.string().required(),
      subtotal: Joi.number().precision(2).required(),
      tax: Joi.number().precision(2).required(),
      total: Joi.number().precision(2).required(),
      deposit: Joi.number().precision(2).required(),
      ticket_details: Joi.string().required(),
      first_name: Joi.string().required(),
      last_name: Joi.string().required(),
      phone: Joi.string()
        .pattern(/^[0-9]{10,15}$/)
        .required(),
      email: Joi.string().email().required(),
      notes: Joi.string().optional().allow(null, ""),
    });

    const { error, value } = bookingSchema.validate(req.body);
    if (error) return handleError(res, 400, error.details[0].message);

    const bookingRepository = getRepository(Booking);
    const bookingPassengerRepository = getRepository(BookingPassenger);

    const {
      booking_id,
      booking_status,
      from_ukraine,
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
    } = value;

    const findBooking = await bookingRepository.findOne({
      where: { id: booking_id },
      relations: ["from", "to", "route"],
    });
    if (!findBooking) return handleError(res, 404, "Booking not found");

    Object.assign(findBooking, {
      booking_status,
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
    });

    await bookingRepository.save(findBooking);

    await bookingPassengerRepository.delete({ booking: { id: booking_id } });

    await Promise.all(
      JSON.parse(ticket_details).map(async (passenger: any) => {
        const newPassenger = bookingPassengerRepository.create({
          booking: findBooking,
          ticket_type: passenger.ticketType,
          selected_seat: passenger.selectedSeat,
          passenger_name: passenger.passengerName,
          price: passenger.price,
        });
        await bookingPassengerRepository.save(newPassenger);
      })
    );

    if (booking_status === "Confirmed") {
      const emailTemplatePath = path.resolve(
        __dirname,
        "../../views/confirm_booking.ejs"
      );
      const emailHtml = await ejs.renderFile(emailTemplatePath, {
        first_name,
        last_name,
        booking_number: findBooking.booking_number,
        from_city: findBooking.from.city_name,
        to_city: findBooking.to.city_name,
        route_title: findBooking.route.title,
        departure_datetime: findBooking.departure_time,
        total_amount: from_ukraine == 'true' ? findBooking.total + '₴' : findBooking.total + '€',
        passengers: JSON.parse(ticket_details),
      });

      const emailOptions = {
        to: email,
        subject: "Your Ticket Has Been Confirmed",
        html: emailHtml,
      };
      await sendEmail(emailOptions);

      return handleSuccess(
        res,
        200,
        "Booking has been successfully confirmed."
      );
    } else if (booking_status === "Cancelled") {
      const emailTemplatePath = path.resolve(
        __dirname,
        "../../views/cancelled_booking.ejs"
      );
      const emailHtml = await ejs.renderFile(emailTemplatePath, {
        first_name,
        last_name,
        booking_number: findBooking.booking_number,
        from_city: findBooking.from.city_name,
        to_city: findBooking.to.city_name,
        route_title: findBooking.route.title,
        departure_datetime: findBooking.departure_time,
        total_amount: from_ukraine == 'true' ? findBooking.total + '₴' : findBooking.total + '€'
      });

      const emailOptions = {
        to: email,
        subject: "Your Ticket Has Been Cancelled",
        html: emailHtml,
      };
      await sendEmail(emailOptions);

      return handleSuccess(
        res,
        200,
        "Booking has been successfully cancelled."
      );
    } else {
      return handleSuccess(res, 200, "Booking successfully updated");
    }
  } catch (error: any) {
    console.error("Error in update booking by id:", error);
    return handleError(res, 500, error.message);
  }
};

export const delete_booking_by_id = async (req: Request, res: Response) => {
  try {
    const bookingSchema = Joi.object({
      booking_id: Joi.string().required(),
    });

    const { error, value } = bookingSchema.validate(req.query);
    if (error) return handleError(res, 400, error.details[0].message);

    const bookingRepository = getRepository(Booking);
    const { booking_id } = value;

    const findBooking = await bookingRepository.findOne({
      where: { id: booking_id, is_deleted: false },
    });
    if (!findBooking)
      return handleError(res, 404, "Booking not found or already deleted");

    await bookingRepository.update({ id: booking_id }, { is_deleted: true });

    return handleSuccess(res, 200, "Booking successfully deleted");
  } catch (error: any) {
    console.error("Error in delete booking by id:", error);
    return handleError(res, 500, error.message);
  }
};

export const get_booking_by_route_date_and_from_to = async (
  req: Request,
  res: Response
) => {
  try {
    const bookingSchema = Joi.object({
      route: Joi.string().required(),
      from: Joi.string().required(),
      to: Joi.string().required(),
      travel_date: Joi.string().isoDate().required(),
    });

    const { error, value } = bookingSchema.validate(req.body);
    if (error) return handleError(res, 400, error.details[0].message);

    const bookingRepository = getRepository(Booking);
    const bookingPassengerRepository = getRepository(BookingPassenger);

    const { route, from, to, travel_date } = value;

    const getAllBooking = await bookingRepository.find({
      where: {
        from: { city_id: from },
        to: { city_id: to },
        route: { route_id: route },
        travel_date: travel_date,
        is_deleted: false,
        payment_status: true,
      },
      relations: ["from", "to", "route"],
    });

    if (!getAllBooking.length)
      return handleError(res, 404, "Booking not found");

    const bookingPassengers = await Promise.all(
      getAllBooking.map(async (product) => {
        const passengers = await bookingPassengerRepository.find({
          where: { booking: { id: product.id } },
        });
        return { ...product, passengers };
      })
    );

    return handleSuccess(res, 200, "Get All Booking", bookingPassengers);
  } catch (error: any) {
    console.error("Error in get booking by route date from to:", error);
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

    const { id } = value;

    const bookingRepository = getRepository(Booking);
    const bookingPassengerRepository = getRepository(BookingPassenger);
    const transactionRepository = getRepository(Transaction);

    // ---------- FETCH ONWARD BOOKING ----------
    const onwardBooking = await bookingRepository.findOne({
      where: {
        id,
        is_deleted: false,
      },
      relations: ["from", "to", "route"],
    });

    if (!onwardBooking) {
      return handleError(res, 404, "Booking not found");
    }

    // ---------- FETCH RETURN BOOKING (IF EXISTS) ----------
    const returnBooking = await bookingRepository.findOne({
      where: {
        parent_booking_id: onwardBooking.id,
        trip_type: "return",
        is_deleted: false,
      },
      relations: ["from", "to", "route"],
    });

    // ---------- ATTACH TRANSACTIONS ----------
    const attachTransaction = async (booking: Booking) => {
      const transaction = await transactionRepository.find({
        where: { booking: { id: booking.id } },
      });
      return { ...booking, transaction };
    };

    const onwardWithTransaction = await attachTransaction(onwardBooking);
    const returnWithTransaction = returnBooking
      ? await attachTransaction(returnBooking)
      : null;

    // ---------- ATTACH PASSENGERS ----------
    const attachPassengers = async (bookingData: any) => {
      const passengers = await bookingPassengerRepository.find({
        where: { booking: { id: bookingData.id } },
      });
      return { ...bookingData, passengers };
    };

    const onwardFinal = await attachPassengers(onwardWithTransaction);
    const returnFinal = returnWithTransaction
      ? await attachPassengers(returnWithTransaction)
      : null;

    // ---------- RESPONSE ----------
    return handleSuccess(res, 200, "Get Ticket Booking", {
      onward: onwardFinal,
      return: returnFinal,
    });

  } catch (error: any) {
    console.error("Error in getTicketBookingByBookingId:", error);
    return handleError(res, 500, error.message);
  }
};


// export const getTicketBookingByBookingId = async (
//   req: Request,
//   res: Response
// ) => {
//   try {
//     const bookingSchema = Joi.object({
//       id: Joi.number().required(),
//     });

//     const { error, value } = bookingSchema.validate(req.query);
//     if (error) return handleError(res, 400, error.details[0].message);

//     const bookingRepository = getRepository(Booking);
//     const bookingPassengerRepository = getRepository(BookingPassenger);

//     const { id } = value;

//     const getAllBooking = await bookingRepository.find({
//       where: { id, is_deleted: false, payment_status: true },
//       relations: ["from", "to", "route"],
//     });

//     if (!getAllBooking.length)
//       return handleError(res, 404, "Booking not found");

//     const bookingPassengers = await Promise.all(
//       getAllBooking.map(async (product) => {
//         const passengers = await bookingPassengerRepository.find({
//           where: { booking: { id: product.id } },
//         });
//         return { ...product, passengers };
//       })
//     );

//     return handleSuccess(res, 200, "Get Ticket Booking", bookingPassengers);
//   } catch (error: any) {
//     console.error("Error in create booking:", error);
//     return handleError(res, 500, error.message);
//   }
// };

export const getTicketBookingTransactions = async (
  req: Request,
  res: Response
) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const search = req.query.search as string;
    const pageNumber = parseInt(page as string, 10);
    const pageLimit = parseInt(limit as string, 10);
    const offset = (pageNumber - 1) * pageLimit;

    const transactionRepository = getRepository(Transaction);
    const bookingRepository = getRepository(Booking);
    const currencyExchangeRepository = getRepository(CurrencyExchangeRate);

    const [allTransactions] = await transactionRepository.findAndCount({
      relations: ["booking"],
      order: { created_at: "DESC" },
    });

    await Promise.all(
      allTransactions.map(async (trx) => {
        const booking = await bookingRepository.findOne({
          where: { id: trx.booking.id },
          relations: ["from", "to", "route"],
        });
        if (booking) {
          let exchangeRate = 1;
          if (booking?.from?.from_ukraine) {
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
          trx.amount = Number((trx.amount / exchangeRate).toFixed(2));
          trx.amount_paid = Number((trx.amount_paid / exchangeRate).toFixed(2));
          trx.booking = booking;
        }
      })
    );

    let searchLower = "";
    if (typeof search === "string") {
      searchLower = search.toLowerCase();
    }

    const filtered = search
      ? allTransactions.filter((trx) => {
        const { booking } = trx;

        if (!booking) return false;

        return (
          booking.first_name?.toLowerCase().includes(searchLower) ||
          booking.last_name?.toLowerCase().includes(searchLower) ||
          booking.phone?.toLowerCase().includes(searchLower) ||
          booking.email?.toLowerCase().includes(searchLower) ||
          trx.transaction_number?.toLocaleLowerCase().includes(searchLower)
        );
      })
      : allTransactions;

    const paginated = filtered.slice(offset, offset + pageLimit);
    const totalFiltered = filtered.length;
    const totalPages = Math.ceil(totalFiltered / pageLimit);

    return handleSuccess(res, 200, "Transaction fetched successfully.", {
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