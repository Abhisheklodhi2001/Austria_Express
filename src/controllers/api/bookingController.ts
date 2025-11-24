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
import { generateBookingNumber, generateTransactionNumber } from "../../utils/function";
import moment from "moment";
import { Transaction } from "../../entities/Transaction";

export const create_booking = async (req: Request, res: Response) => {
  try {
    const bookingSchema = Joi.object({
      route: Joi.string().required(),
      route_name: Joi.string().required(),
      from: Joi.string().required(),
      from_city: Joi.string().required(),
      from_ukraine: Joi.required().allow(true, false),
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
      notes: Joi.string().optional().allow(null, ""),
    });

    const { error, value } = bookingSchema.validate(req.body);
    if (error) return handleError(res, 400, error.details[0].message);

    const bookingRepository = getRepository(Booking);
    const bookingPassengerRepository = getRepository(BookingPassenger);
    const transactionRepository = getRepository(Transaction);

    const {
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
    } = value;
    const user_req = req.user as IUser;

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
      booking_user_id: user_req.id,
      payment_status: payment_method == "Cash" ? true : false,
    });
    await bookingRepository.save(newBooking);

    JSON.parse(ticket_details).map(async (passenger: any) => {
      const newPassenger = bookingPassengerRepository.create({
        booking: newBooking,
        ticket_type: passenger.ticketType,
        selected_seat:
          passenger.selectedSeat == "" ? null : passenger.selectedSeat,
        passenger_name: passenger.passengerName,
        price: passenger.price,
      });
      await bookingPassengerRepository.save(newPassenger);
    });

    if (payment_method == "Cash") {
      const transaction = transactionRepository.create({
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
      await transactionRepository.save(transaction);

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
        total: from_ukraine == 'true' ? total +  '₴' : total +  '€',
        departure_time,
        arrival_time,
        payment_method,
        route_name,
        from_city,
        to_city,
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