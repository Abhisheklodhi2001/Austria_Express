import Joi from "joi";
import ejs, { name } from 'ejs';
import path from "path";
import crypto from "crypto";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { IAdmin } from "../../models/Admin";
import { Admin } from "../../entities/Admin";
import { Request, Response } from "express";
import { getRepository, IsNull, LessThanOrEqual, MoreThanOrEqual, MoreThan, Not, And, Like, In, Between } from "typeorm";
import { sendEmail } from "../../services/otpService";
import { handleError, handleSuccess } from "../../utils/responseHandler";
import { BusSchedule } from "../../entities/BusSchedule";
import { Booking } from "../../entities/Booking";
import moment from "moment";
import { RouteClosure } from "../../entities/RouteClosure";
import { Route_Stops } from "../../entities/RouteStop";
import { CurrencyExchangeRate } from "../../entities/currency_exchange_rate";
import { BookingPassenger } from "../../entities/BookingPassenger";

dotenv.config();

const APP_URL = process.env.APP_URL as string;
const image_logo = process.env.LOGO_URL as string;

const generateVerificationLink = (token: string, baseUrl: string) => {
  return `${baseUrl}/admin/verify-email?token=${token}`;
};

const generateAccessToken = (payload: {
  adminId: number;
  email: string;
}) => {
  const JWT_SECRET = process.env.JWT_SECRET as string;
  const JWT_EXPIRATION = process.env.JWT_EXPIRATION || "30d";
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
};

export const register_admin = async (req: Request, res: Response) => {
  try {
    const registerSchema = Joi.object({
      name: Joi.string().required(),
      mobile_number: Joi.string().required().allow(""),
      email: Joi.string().required(),
      password: Joi.string().min(8).required(),
    });
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return handleError(res, 400, error.details[0].message);
    }
    const { name, password, mobile_number, email } = value;
    const adminRepository = getRepository(Admin);

    const existEmail = await adminRepository.findOne({ where: { email } });
    if (existEmail) {
      return handleError(res, 400, "Email already exists.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenExpiry = new Date(Date.now() + 3600000);

    const newAdmin = adminRepository.create({
      name: name,
      mobile_number: mobile_number,
      email: email,
      password: hashedPassword,
      show_password: password,
      verify_token: verifyToken,
      verify_token_expiry: verifyTokenExpiry,
      is_verified: true
    });


    const baseUrl = req.protocol + '://' + req.get('host');
    const verificationLink = generateVerificationLink(verifyToken, baseUrl);

    const emailTemplatePath = path.resolve(__dirname, '../../views/verifyAccount.ejs');
    const emailHtml = await ejs.renderFile(emailTemplatePath, { verificationLink, image_logo });

    const emailOptions = {
      to: email,
      subject: "Verify Your Email Address",
      html: emailHtml,
    };
    // await sendEmail(emailOptions);

    const savedAdmin = await adminRepository.save(newAdmin);
    return handleSuccess(res, 201, `Admin Account is created Successfully`);
    // return handleSuccess(res, 201, `Verification link sent successfully to your email (${email}). Please verify your account.`);
  } catch (error: any) {
    console.error('Error in register:', error);
    return handleError(res, 500, error.message);
  }
};

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const tokenSchema = Joi.object({
      token: Joi.string().required()
    })
    const { error, value } = tokenSchema.validate(req.query)
    if (error) {
      return handleError(res, 400, error.details[0].message)
    }
    const { token } = value

    const adminRepository = getRepository(Admin);
    const admin = await adminRepository.findOne({
      where: {
        verify_token: token,
        verify_token_expiry: MoreThan(new Date())
      }
    });

    if (!admin) {
      return res.render("sessionExpire.ejs")
    }
    admin.is_verified = true;
    admin.verify_token = null;
    admin.verify_token_expiry = null;
    await adminRepository.save(admin);

    return res.render("successRegister.ejs")
  } catch (error: any) {
    console.error('Error in verifyEmail:', error);
    return handleError(res, 500, error.message);
  }
};

export const login_admin = async (req: Request, res: Response) => {
  try {
    const loginSchema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(8).required(),
    });
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return handleError(res, 400, error.details[0].message);
    }

    const { email, password } = value;

    const adminRepository = getRepository(Admin);
    const admin = await adminRepository.findOneBy({ email });

    if (!admin) {
      return handleError(res, 404, "Admin not found. Please check the email and try again.");
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return handleError(res, 400, "Incorrect password. Please try again.")
    }

    if (admin.is_verified == false) {
      return handleError(res, 400, "Your email is not verified. Please check your inbox for the verification link.")
    }

    const payload = { adminId: admin.id, email: admin.email };
    const token = generateAccessToken(payload);

    admin.jwt_token = token;
    await adminRepository.save(admin);

    return handleSuccess(res, 200, "Login Successful.", token)
  } catch (error: any) {
    return handleError(res, 500, error.message);
  }
};

export const render_forgot_password_page = (req: Request, res: Response) => {
  try {
    return res.render("resetPasswordAdmin.ejs");
  } catch (error: any) {
    return handleError(res, 500, error.message)
  }
};

export const forgot_password = async (req: Request, res: Response) => {
  try {

    const forgotPasswordSchema = Joi.object({
      email: Joi.string().email().required(),
    });
    const { error, value } = forgotPasswordSchema.validate(req.body);
    if (error) {
      return handleError(res, 400, error.details[0].message);
    }
    const { email } = value;
    const adminRepository = getRepository(Admin)
    const admin = await adminRepository.findOneBy({ email });
    if (!admin) {
      return handleError(res, 404, "Admin Not Found")
    }
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyTokenExpiry = new Date(Date.now() + 3600000);

    if (admin.is_verified == false) {
      return handleError(res, 400, "Please Verify your email first")
    }
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 3600000);
    admin.reset_password_token = resetToken;
    admin.reset_password_token_expiry = resetTokenExpiry;
    await adminRepository.save(admin);
    const resetLink = `${req.protocol}://${req.get("host")}/admin/reset-password?token=${resetToken}`;
    const emailTemplatePath = path.resolve(__dirname, '../../views/forgotPassword.ejs');
    const emailHtml = await ejs.renderFile(emailTemplatePath, { resetLink, image_logo });
    const emailOptions = {
      to: email,
      subject: "Password Reset Request",
      html: emailHtml,
    };
    await sendEmail(emailOptions);
    return handleSuccess(res, 200, `Password reset link sent to your email (${email}).`);
  } catch (error: any) {
    console.error("Error in forgot password controller:", error);
    return handleError(res, 500, error.message);
  }
};

export const reset_password = async (req: Request, res: Response) => {
  try {
    const resetPasswordSchema = Joi.object({
      token: Joi.string().required(),
      newPassword: Joi.string().min(8).required().messages({
        "string.min": "Password must be at least 8 characters long",
        "any.required": "New password is required",
      }),
    });
    const { error, value } = resetPasswordSchema.validate(req.body);
    if (error) {
      return handleError(res, 400, error.details[0].message);
    }
    const { token, newPassword } = value;
    const adminRepository = getRepository(Admin);
    const admin = await adminRepository.findOne({
      where: {
        reset_password_token: token,
        reset_password_token_expiry: MoreThan(new Date()),
      },
    });
    if (!admin) {
      return handleError(res, 400, "Invalid or expired token")
    }

    if (admin.show_password == newPassword) {
      return handleError(res, 400, "Password cannot be the same as the previous password.");
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    admin.password = hashedPassword;
    admin.show_password = newPassword;
    admin.reset_password_token = null;
    admin.reset_password_token_expiry = null;
    await adminRepository.save(admin);
    return handleSuccess(res, 200, "Password reset successfully.",)
  } catch (error: any) {
    console.error("Error in reset password controller:", error);
    return handleError(res, 500, error.message);
  }
};

export const render_success_register = (req: Request, res: Response) => {
  return res.render("successRegister.ejs")
};

export const render_success_reset = (req: Request, res: Response) => {
  return res.render("successReset.ejs")
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const admin_req = req.admin as IAdmin;
    const adminRepository = getRepository(Admin);
    const admin = await adminRepository.findOneBy({ id: admin_req.id });
    if (!admin) {
      return handleError(res, 404, "Admin Not Found")
    }
    if (admin.profile_image && !admin.profile_image.startsWith("http")) {
      admin.profile_image = `${APP_URL}${admin.profile_image}`;
    }
    return handleSuccess(res, 200, "Admin profile fetched successfully", admin);
  } catch (error: any) {
    return handleError(res, 500, error.message)
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const updateProfileSchema = Joi.object({
      name: Joi.string().required(),
      mobile_number: Joi.string().required(),
      email: Joi.string().email().required(),
    });

    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) {
      return handleError(res, 400, error.details[0].message);
    }
    const { name, mobile_number, email } = value;
    const admin_req = req.admin as IAdmin;
    const adminRepository = getRepository(Admin);

    const admin = await adminRepository.findOne({ where: { id: admin_req.id } });
    if (!admin) {
      return handleError(res, 404, "Admin Not Found")
    }
    if (name) admin.name = name;
    if (mobile_number) admin.mobile_number = mobile_number;
    if (email) admin.email = email;
    if (req.file) {
      let profile_image = "";
      profile_image = req.file.filename;
      admin.profile_image = profile_image;
    }
    await adminRepository.save(admin);
    return handleSuccess(res, 200, "Profile updated successfully");

  } catch (error: any) {
    return handleError(res, 500, error.message);
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const changePasswordSchema = Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: Joi.string().min(8).required(),
    });
    const { error } = changePasswordSchema.validate(req.body);
    if (error) {
      return handleError(res, 400, error.details[0].message)
    }
    const admin_req = req.admin as IAdmin;
    const { currentPassword, newPassword } = req.body;
    const adminRepository = getRepository(Admin);

    const admin = await adminRepository.findOneBy({ id: admin_req.id });
    if (!admin) {
      return handleError(res, 404, "Admin Not Found")
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return handleError(res, 400, "Current password is incorrect")
    }
    if (admin.show_password == newPassword) {
      return handleError(res, 400, "Password cannot be the same as the previous password.");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    admin.password = hashedPassword;
    admin.show_password = newPassword;
    await adminRepository.save(admin);
    return handleSuccess(res, 200, "Password changed successfully")
  } catch (error: any) {
    return handleError(res, 500, error.message)
  }
};

export const dashboard_details = async (req: Request, res: Response) => {
  try {
    const busscheduleRepository = getRepository(BusSchedule);
    const routeClosureRepository = getRepository(RouteClosure);
    const routeStopRepository = getRepository(Route_Stops);
    const bookingRepository = getRepository(Booking);
    const bookingPassengerRepository = getRepository(BookingPassenger);
    const currencyExchangeRepository = getRepository(CurrencyExchangeRate);

    const travelDate = moment().format('YYYY-MM-DD');
    const weekday = moment().format('dddd');

    const startOfMonth = moment().startOf('month').toDate();
    const endOfMonth = moment().endOf('month').toDate();

    const totalBuses = await busscheduleRepository.find({
      where: [
        { from: And(Not(IsNull()), LessThanOrEqual(travelDate)), to: And(Not(IsNull()), MoreThanOrEqual(travelDate)), days_of_week: Like(`%${weekday}%`), is_deleted: false },
        { from: IsNull(), to: IsNull(), days_of_week: Like(`%${weekday}%`), is_deleted: false }
      ],
      relations: ['bus', 'route']
    });

    const routeIds = totalBuses.filter(schedule => schedule.route && schedule.route.is_deleted == false).map(schedule => schedule.route.route_id);

    const closedRoutes = await routeClosureRepository.find({
      where: {
        route: In(routeIds),
        from_date: And(Not(IsNull()), LessThanOrEqual(travelDate)),
        to_date: And(Not(IsNull()), MoreThanOrEqual(travelDate))
      }
    });
    const closedRouteIds = new Set(closedRoutes.map(routeClosure => routeClosure.route?.route_id));
    const filteredBusSchedules = totalBuses.filter(schedule => !closedRouteIds.has(schedule.route?.route_id) && schedule.route.is_deleted == false);
    const filteredRouteIds = filteredBusSchedules.map(schedule => schedule.route?.route_id).filter(Boolean);
    const routeStops = await routeStopRepository.find({
      where: {
        route: In(filteredRouteIds),
        is_deleted: false,
        is_active: true
      },
      relations: ['route'],
      order: { stop_order: 'ASC' }
    });

    const routeTimeMap: Record<number, { first_departure: string | null, last_arrival: string | null }> = {};

    filteredRouteIds.forEach(routeId => {
      const stops = routeStops.filter(stop => stop.route.route_id === routeId);

      const firstDepartureStop = stops.find(stop => stop.departure_time);
      const lastArrivalStop = [...stops].reverse().find(stop => stop.arrival_time);

      routeTimeMap[routeId] = {
        first_departure: firstDepartureStop?.departure_time || null,
        last_arrival: lastArrivalStop?.arrival_time || null
      };
    });

    const todayBookings = await bookingRepository.find({
      where: {
        travel_date: travelDate,
        route: In(filteredRouteIds),
        is_deleted: false,
        payment_status: true,
        booking_status: 'Confirmed'
      },
      relations: ['route']
    });

    let passengerCounts: any[] = [];

    if (todayBookings.length > 0) {
      const bookingIds = todayBookings.map(booking => booking.id);

      passengerCounts = await bookingPassengerRepository
        .createQueryBuilder('bp')
        .select('bp.booking', 'booking_id')
        .addSelect('COUNT(*)', 'passenger_count')
        .where('bp.booking IN (:...bookingIds)', { bookingIds })
        .groupBy('bp.booking')
        .getRawMany();
    }
    const passengerCountMap: Record<number, number> = {};

    passengerCounts.forEach(({ booking_id, passenger_count }) => {
      const booking = todayBookings.find(b => b.id === booking_id);
      const routeId = booking?.route?.route_id;

      if (routeId) {
        passengerCountMap[routeId] = (passengerCountMap[routeId] || 0) + Number(passenger_count);
      }
    });

    const finalBuses = filteredBusSchedules.map(schedule => {
      const routeId = schedule.route?.route_id;
      const timing = routeTimeMap[routeId] || { first_departure: null, last_arrival: null };
      const bookingCount = passengerCountMap[routeId] || 0;

      return {
        ...schedule,
        first_departure_time: timing.first_departure,
        last_arrival_time: timing.last_arrival,
        booking_count: bookingCount
      };
    });

    const latestBooking = await bookingRepository.find({
      where: { is_deleted: false, payment_status: true },
      order: { created_at: "DESC" },
      take: 10,
      relations: ['route', 'from', 'to']
    });

    const allBookings = await bookingRepository.find({
      where: { is_deleted: false, payment_status: true, created_at: Between(moment().startOf('year').toDate(), moment().endOf('year').toDate()) },
      order: { created_at: "DESC" },
      relations: ['route', 'from', 'to']
    });

    const bookingsPerMonth: Record<string, number> = {};
    allBookings.forEach(booking => {
      const month = moment(booking.created_at).format('MMM');
      bookingsPerMonth[month] = (bookingsPerMonth[month] || 0) + 1;
    });

    const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const totalBookingsPerMonth = monthOrder
      .filter(month => bookingsPerMonth[month])
      .map(month => ({
        month,
        totalBookings: bookingsPerMonth[month]
      }));

    const upcomingBookings = allBookings.filter(booking => moment(booking.created_at).isBetween(moment().startOf('day'), moment().add(7, 'days').endOf('day'), 'day', '[]')
    );

    let confirmedCount = 0;
    let pendingCount = 0;

    upcomingBookings.forEach(booking => {
      if (booking.booking_status === 'Confirmed') {
        confirmedCount++;
      } else if (booking.booking_status === 'Pending') {
        pendingCount++;
      }
    });

    let exchangeRate = 1;

    const hasUkraineBooking = allBookings.some(
      booking => booking.from?.from_ukraine
    );

    if (hasUkraineBooking) {
      const currencyData = await currencyExchangeRepository.findOne({
        where: {
          from_currency: 'EUR',
          to_currency: 'UAH'
        }
      });

      if (currencyData) {
        exchangeRate = Number(currencyData.rate) || 1;
      } else {
        console.warn(`Exchange rate not found for EUR to UAH, using default 1`);
      }
    }

    const currentMonthBookings = allBookings.filter(booking => moment(booking.created_at).isBetween(startOfMonth, endOfMonth, 'day', '[]'));

    const totalEarnings = currentMonthBookings.reduce((sum, booking) => {
      const total = Number(booking.total) || 0;
      const isFromUkraine = booking.from?.from_ukraine;
      const convertedTotal = isFromUkraine ? total / exchangeRate : total;
      return sum + convertedTotal;
    }, 0);

    const [Confirmed, Pending, Cancelled] = await Promise.all([
      bookingRepository.count({ where: { booking_status: 'Confirmed', is_deleted: false, payment_status: true } }),
      bookingRepository.count({ where: { booking_status: 'Pending', is_deleted: false, payment_status: true } }),
      bookingRepository.count({ where: { booking_status: 'Cancelled', is_deleted: false, payment_status: true } })
    ]);

    const bookingStatusCounts = { Confirmed, Pending, Cancelled };

    const data = {
      todayBuses: finalBuses,
      latestBooking,
      totalBookingsPerMonth,
      allBookings: {
        bookingCount: currentMonthBookings.length,
        totalEarnings: Number(totalEarnings),
        confirmedCount,
        pendingCount
      },
      bookingStatusInAGraph: bookingStatusCounts
    };

    return handleSuccess(res, 200, "Dashboard Data Retrieved Successfully", data);
  } catch (error: any) {
    return handleSuccess(res, 500, error.message);
  }
};