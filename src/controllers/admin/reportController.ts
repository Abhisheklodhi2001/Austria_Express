import Joi from "joi";
import { And, Between, getRepository, In, IsNull, LessThanOrEqual, Like, MoreThanOrEqual, Not } from "typeorm";
import moment from "moment";
import { Request, Response } from "express";
import { handleSuccess, handleError, joiErrorHandle } from "../../utils/responseHandler";
import { Booking } from "../../entities/Booking";
import { BookingPassenger } from "../../entities/BookingPassenger";
import { User } from "../../entities/User";
import { CurrencyExchangeRate } from "../../entities/currency_exchange_rate";
import { BusSchedule } from "../../entities/BusSchedule";
import { Route_Stops } from "../../entities/RouteStop";
import { RouteClosure } from "../../entities/RouteClosure";

export const bookingReports = async (req: Request, res: Response) => {
    try {
        const bookingOverviewSchema = Joi.object({
            report_date: Joi.string().required().allow('', null)
        });

        const { error, value } = bookingOverviewSchema.validate(req.body);

        if (error) {
            return handleError(res, 400, error.details[0].message);
        }
        const { report_date } = value;

        const bookingRepository = getRepository(Booking);
        const bookingPassengerRepository = getRepository(BookingPassenger);

        const [totalBookings, confirmedBookings, pendingBookings, cancelledBookings, totalEarnings] = await Promise.all([
            bookingRepository.count({ where: { is_deleted: false, payment_status: true } }),
            bookingRepository.count({ where: { booking_status: 'Confirmed', is_deleted: false, payment_status: true } }),
            bookingRepository.count({ where: { booking_status: 'Pending', is_deleted: false, payment_status: true } }),
            bookingRepository.count({ where: { booking_status: 'Cancelled', is_deleted: false, payment_status: true } }),
            (await bookingRepository.find({ where: { is_deleted: false, payment_status: true } })).reduce((sum, booking) => sum + (Number(booking.total) || 0), 0)
        ]);

        let bookingOverview: any = [];

        if (report_date === "day") {
            const startOfDay = moment.utc().startOf("day").toDate();
            const endOfDay = moment.utc().endOf("day").toDate();
            bookingOverview = await bookingRepository.count({
                where: {
                    is_deleted: false,
                    payment_status: true,
                    created_at: Between(startOfDay, endOfDay)
                }
            });
        } else if (report_date === "week") {
            bookingOverview = await bookingRepository.find({
                where: {
                    is_deleted: false,
                    payment_status: true,
                    created_at: Between(moment().startOf('isoWeek').toDate(), moment().endOf('isoWeek').toDate())
                }
            });

            const weekSummary: any = {};
            bookingOverview.forEach((booking: Booking) => {
                const dayName = moment(booking.created_at).format("ddd");
                weekSummary[dayName] = (weekSummary[dayName] || 0) + 1;
            });

            bookingOverview = weekSummary;

        } else if (report_date === "year") {
            const yearlyBookings = await bookingRepository.find({
                where: {
                    is_deleted: false,
                    payment_status: true,
                    created_at: Between(moment().startOf('year').toDate(), moment().endOf('year').toDate())
                },
                order: { created_at: "DESC" },
                relations: ['route', 'from', 'to']
            });

            const monthSummary: any = {};
            yearlyBookings.forEach(booking => {
                const monthName = moment(booking.created_at).format("MMM");
                monthSummary[monthName] = (monthSummary[monthName] || 0) + 1;
            });

            const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

            const totalBookingsPerMonth = monthOrder
                .filter(month => monthSummary[month])
                .map(month => ({
                    month,
                    totalBookings: monthSummary[month]
                }));

            bookingOverview = totalBookingsPerMonth;
        }

        const totalPassengerOnboard = await bookingRepository.find({
            where: { is_deleted: false, payment_status: true },
            order: { created_at: 'DESC' },
            relations: ['route', 'from', 'to']
        });

        const passengerPromises = totalPassengerOnboard.map(async (val) => {
            const passengers = await bookingPassengerRepository.count({ where: { booking: { id: val.id } } });
            return { ...val, passengers };
        });

        const passengers = await Promise.all(passengerPromises);

        const data = {
            bookingReportForAHeader: { totalBookings, confirmedBookings, pendingBookings, cancelledBookings, totalEarnings },
            bookingOverview,
            booking: passengers
        }

        return handleSuccess(res, 200, "Booking Reports Data Retrieved Successfully", data);
    } catch (error: any) {
        return handleSuccess(res, 500, error.message);
    }
};

export const bookingReportsTypeOfTicket = async (req: Request, res: Response) => {
    try {
        const bookingOverviewSchema = Joi.object({
            report_date: Joi.string().required().valid('day', 'week', 'year')
        });

        const { error, value } = bookingOverviewSchema.validate(req.body);

        if (error) {
            return handleError(res, 400, error.details[0].message);
        }

        const { report_date } = value;

        const bookingRepository = getRepository(Booking);
        const bookingPassengerRepository = getRepository(BookingPassenger);

        let startDate: Date, endDate: Date;

        if (report_date === "day") {
            startDate = moment.utc().startOf("day").toDate();
            endDate = moment.utc().endOf("day").toDate();
        } else if (report_date === "week") {
            startDate = moment().startOf('isoWeek').toDate();
            endDate = moment().endOf('isoWeek').toDate();
        } else {
            startDate = moment().startOf('year').toDate();
            endDate = moment().endOf('year').toDate();
        }

        const bookings = await bookingRepository.find({
            where: {
                is_deleted: false,
                payment_status: true,
                created_at: Between(startDate, endDate)
            }
        });

        const bookingIds = bookings.map(b => b.id);
        if (bookingIds.length === 0) return handleSuccess(res, 200, "No bookings found in this period", []);

        const passengers = await bookingPassengerRepository.find({
            where: {
                booking: In(bookingIds)
            },
            select: ['ticket_type']
        });

        const ticketCountsMap: Record<string, number> = {};
        passengers.forEach(p => {
            ticketCountsMap[p.ticket_type] = (ticketCountsMap[p.ticket_type] || 0) + 1;
        });

        const ticketCounts = Object.entries(ticketCountsMap).map(([ticket_type, count]) => ({
            ticket_type,
            count
        }));

        return handleSuccess(res, 200, "Ticket type report fetched successfully", ticketCounts);
    } catch (error: any) {
        return handleError(res, 500, error.message);
    }
};

export const earningReports = async (req: Request, res: Response) => {
    try {
        const bookingOverviewSchema = Joi.object({
            report_date: Joi.string().required().allow('', null)
        });

        const { error, value } = bookingOverviewSchema.validate(req.body);

        if (error) {
            return handleError(res, 400, error.details[0].message);
        }
        const { report_date } = value;

        const bookingRepository = getRepository(Booking);
        const currencyExchangeRepository = getRepository(CurrencyExchangeRate);

        const [totalBookings, confirmedBookings, pendingBookings, cancelledBookings, totalEarnings] = await Promise.all([
            bookingRepository.count({ where: { is_deleted: false, payment_status: true } }),
            bookingRepository.count({ where: { booking_status: 'Confirmed', is_deleted: false, payment_status: true } }),
            bookingRepository.count({ where: { booking_status: 'Pending', is_deleted: false, payment_status: true } }),
            bookingRepository.count({ where: { booking_status: 'Cancelled', is_deleted: false, payment_status: true } }),
            (await bookingRepository.find({ where: { is_deleted: false, payment_status: true } })).reduce((sum, booking) => sum + (Number(booking.total) || 0), 0)
        ]);

        let exchangeRate = 1;
        const currencyData = await currencyExchangeRepository.findOne({
            where: {
                from_currency: 'EUR',
                to_currency: 'UAH'
            }
        });
        if (currencyData) {
            exchangeRate = Number(currencyData.rate) || 1;
        }

        let earningOverview: any = [];

        if (report_date === "day") {
            const startOfDay = moment().startOf("day").toDate();
            const endOfDay = moment().endOf("day").toDate();

            const dayBookings = await bookingRepository.find({
                where: {
                    is_deleted: false,
                    payment_status: true,
                    created_at: Between(startOfDay, endOfDay)
                },
                relations: ['from']
            });

            const total = dayBookings.reduce((sum, booking) => {
                const isFromUkraine = booking.from?.from_ukraine;
                const adjustedTotal = isFromUkraine ? Number(booking.total) / exchangeRate : Number(booking.total);
                return sum + (adjustedTotal || 0);
            }, 0);

            earningOverview = { total_earning: total };

        } else if (report_date === "week") {
            const weeklyBookings = await bookingRepository.find({
                where: {
                    is_deleted: false,
                    payment_status: true,
                    created_at: Between(moment().startOf('isoWeek').toDate(), moment().endOf('isoWeek').toDate())
                },
                relations: ['from']
            });

            const weekSummary: any = {};
            weeklyBookings.forEach((booking) => {
                const dayName = moment(booking.created_at).format("ddd");
                const isFromUkraine = booking.from?.from_ukraine;
                const adjustedTotal = isFromUkraine ? Number(booking.total) / exchangeRate : Number(booking.total);

                weekSummary[dayName] = (weekSummary[dayName] || 0) + (adjustedTotal || 0);
            });

            earningOverview = weekSummary;
        } else if (report_date === "year") {
            const yearlyBookings = await bookingRepository.find({
                where: {
                    is_deleted: false,
                    payment_status: true,
                    created_at: Between(moment().startOf('year').toDate(), moment().endOf('year').toDate())
                },
                relations: ['from']
            });

            const rawMonthSummary: any = {};
            const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

            yearlyBookings.forEach(booking => {
                const monthName = moment(booking.created_at).format("MMM");
                const isFromUkraine = booking.from?.from_ukraine;
                const adjustedTotal = isFromUkraine ? Number(booking.total) / exchangeRate : Number(booking.total);

                rawMonthSummary[monthName] = (rawMonthSummary[monthName] || 0) + (adjustedTotal || 0);
            });

            const sortedMonthSummary: any = {};
            monthOrder.forEach(month => {
                if (rawMonthSummary[month]) {
                    sortedMonthSummary[month] = Number(rawMonthSummary[month].toFixed(2));
                }
            });
            earningOverview = sortedMonthSummary;
        }

        const data = {
            bookingReportForAHeader: { totalBookings, confirmedBookings, pendingBookings, cancelledBookings, totalEarnings },
            earningOverview
        }

        return handleSuccess(res, 200, "Booking Reports Data Retrieved Successfully", data);
    } catch (error: any) {
        return handleSuccess(res, 500, error.message);
    }
};

export const earningReportsTypeOfTicket = async (req: Request, res: Response) => {
  try {
    const schema = Joi.object({
      report_date: Joi.string().required().valid('day', 'week', 'year')
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return handleError(res, 400, error.details[0].message);
    }

    const { report_date } = value;
    const bookingRepository = getRepository(Booking);
    const passengerRepository = getRepository(BookingPassenger);

    let startDate: Date, endDate: Date;
    if (report_date === 'day') {
      startDate = moment.utc().startOf('day').toDate();
      endDate = moment.utc().endOf('day').toDate();
    } else if (report_date === 'week') {
      startDate = moment().startOf('isoWeek').toDate();
      endDate = moment().endOf('isoWeek').toDate();
    } else {
      startDate = moment().startOf('year').toDate();
      endDate = moment().endOf('year').toDate();
    }

    const bookings = await bookingRepository.find({
      where: {
        is_deleted: false,
        payment_status: true,
        created_at: Between(startDate, endDate)
      },
      relations: ['from']  
    });

    console.log('bookings', bookings);

    const bookingIds = bookings.map(b => b.id);
    if (bookingIds.length === 0) {
      return handleSuccess(res, 200, 'No bookings found', []);
    }

    console.log('bookingIds', bookingIds);

    const passengers = await passengerRepository.find({
      where: { booking: In(bookingIds) },
      select: ['ticket_type', 'price'],
      relations: ['booking'] 
    });


    const convertUAHtoEUR = (amount: number) => amount * 0.025;

    console.log('passengers', passengers);


    const earningsMap: Record<string, number> = {};

    bookings.forEach(booking => {
      const isUkraine = booking.from?.from_ukraine; 
      const relatedPassengers = passengers.filter(p => p.booking.id === booking.id);

      relatedPassengers.forEach(p => {
        const type = p.ticket_type;
        const price = Number(p.price) || 0;

    
        const finalPrice = isUkraine ? convertUAHtoEUR(price) : price;
        console.log('finalPrice', finalPrice);

        if (!earningsMap[type]) earningsMap[type] = 0;
        earningsMap[type] += finalPrice;
      });
    });

    const summary = Object.entries(earningsMap).map(([ticket_type, total_earning]) => ({
      ticket_type,
      total_earning: Number(total_earning.toFixed(2))
    }));
    console.log('summary', summary);

    return handleSuccess(res, 200, 'Earnings report fetched successfully', summary);
  } catch (err: any) {
    return handleSuccess(res, 500, err.message);
  }
};



// export const earningReportsTypeOfTicket = async (req: Request, res: Response) => {
//     try {
//         const bookingOverviewSchema = Joi.object({
//             report_date: Joi.string().required().valid('day', 'week', 'year')
//         });

//         const { error, value } = bookingOverviewSchema.validate(req.body);

//         if (error) {
//             return handleError(res, 400, error.details[0].message);
//         }

//         const { report_date } = value;

//         const bookingRepository = getRepository(Booking);
//         const bookingPassengerRepository = getRepository(BookingPassenger);

//         let startDate: Date, endDate: Date;

//         if (report_date === "day") {
//             startDate = moment.utc().startOf("day").toDate();
//             endDate = moment.utc().endOf("day").toDate();
//         } else if (report_date === "week") {
//             startDate = moment().startOf('isoWeek').toDate();
//             endDate = moment().endOf('isoWeek').toDate();
//         } else {
//             startDate = moment().startOf('year').toDate();
//             endDate = moment().endOf('year').toDate();
//         }

//         const bookings = await bookingRepository.find({
//             where: {
//                 is_deleted: false,
//                 payment_status: true,
//                 created_at: Between(startDate, endDate)
//             }
//         });

//         const bookingIds = bookings.map(b => b.id);
//         if (bookingIds.length === 0) return handleSuccess(res, 200, "No bookings found in this period", []);

//         const passengers = await bookingPassengerRepository.find({
//             where: {
//                 booking: In(bookingIds)
//             },
//             select: ['ticket_type', 'price']
//         });

//         const earningsMap: Record<string, number> = {};
//         passengers.forEach(p => {
//             const type = p.ticket_type;
//             const price = Number(p.price) || 0;

//             if (!earningsMap[type]) earningsMap[type] = 0;
//             earningsMap[type] += price;
//         });

//         const earningsSummary = Object.entries(earningsMap).map(([ticket_type, total_earning]) => ({
//             ticket_type,
//             total_earning
//         }));

//         return handleSuccess(res, 200, "Earnings report by ticket type fetched successfully", earningsSummary);
//     } catch (error: any) {
//         return handleSuccess(res, 500, error.message);
//     }
// };

export const userReports = async (req: Request, res: Response) => {
    try {
        const bookingRepository = getRepository(Booking);
        const userRepository = getRepository(User)

        const bookings = await bookingRepository.find({ where: { is_deleted: false, payment_status: true }, select: ['first_name', 'last_name', 'email', 'travel_date'] });

        const userBookingStats: Record<string, { first_name: string, last_name: string, total_bookings: number, last_trip_date: Date }> = {};
        const now = moment();
        bookings.forEach(booking => {
            const { first_name, last_name, email, travel_date } = booking;
            const travelDateMoment = moment(travel_date);
            if (email && travelDateMoment.isSameOrBefore(now, 'day')) {
                if (!userBookingStats[email]) {
                    userBookingStats[email] = {
                        first_name,
                        last_name,
                        total_bookings: 1,
                        last_trip_date: travelDateMoment.toDate()
                    };
                } else {
                    userBookingStats[email].total_bookings += 1;
                    if (travelDateMoment.isAfter(moment(userBookingStats[email].last_trip_date))) {
                        userBookingStats[email].last_trip_date = travelDateMoment.toDate();
                    }
                }
            }
        });
        const sortedUsers = Object.entries(userBookingStats)
            .map(([email, stats]) => ({
                first_name: stats.first_name,
                last_name: stats.last_name,
                email,
                total_bookings: stats.total_bookings,
                last_trip_date: stats.last_trip_date
            }))
            .sort((a, b) => b.total_bookings - a.total_bookings);

        const totalUsers = await userRepository.find({ where: { is_verified: true, is_active: true, is_blocked: false }, select: ['id', 'guest_user'] })

        let guestUsersCount = 0;
        let registeredUsersCount = 0;

        totalUsers.forEach(user => {
            if (user.guest_user === null) {
                registeredUsersCount++;
            } else {
                guestUsersCount++;
            }
        });

        const data = {
            sortedUsers,
            guestUsersCount,
            registeredUsersCount
        }

        return handleSuccess(res, 200, "Users report fetched successfully", data);
    } catch (error: any) {
        return handleError(res, 500, error.message);
    }
};

export const upcomingBusesReport = async (req: Request, res: Response) => {
    try {
        const busscheduleRepository = getRepository(BusSchedule);
        const routeClosureRepository = getRepository(RouteClosure);
        const routeStopRepository = getRepository(Route_Stops);
        const bookingRepository = getRepository(Booking);
        const bookingPassengerRepository = getRepository(BookingPassenger);

        const now = moment();
        const today = now.format("YYYY-MM-DD");

        const daysToCheck = 7;
        let finalBuses: any[] = [];

        for (let i = 0; i < daysToCheck; i++) {
            const dateToCheck = moment().add(i, 'days');
            const dateStr = dateToCheck.format("YYYY-MM-DD");
            const weekday = dateToCheck.format("dddd");

            const schedules = await busscheduleRepository.find({
                where: [
                    {
                        from: And(Not(IsNull()), LessThanOrEqual(dateStr)),
                        to: And(Not(IsNull()), MoreThanOrEqual(dateStr)),
                        days_of_week: Like(`%${weekday}%`),
                        is_active: true,
                        is_deleted: false
                    },
                    {
                        from: IsNull(),
                        to: IsNull(),
                        days_of_week: Like(`%${weekday}%`),
                        is_active: true,
                        is_deleted: false
                    }
                ],
                relations: ['bus', 'route']
            });

            const routeIds = schedules.filter(schedule => schedule.route && schedule.route.is_deleted == false).map(schedule => schedule.route.route_id);

            const closedRoutes = await routeClosureRepository.find({
                where: {
                    route: In(routeIds),
                    from_date: And(Not(IsNull()), LessThanOrEqual(dateStr)),
                    to_date: And(Not(IsNull()), MoreThanOrEqual(dateStr))
                }
            });

            const closedRouteIds = new Set(closedRoutes.map(rc => rc.route?.route_id));
            const validSchedules = schedules.filter(s => !closedRouteIds.has(s.route?.route_id) && s.route.is_deleted == false);

            const routeStops = await routeStopRepository.find({
                where: {
                    route: In(routeIds),
                    is_deleted: false,
                    is_active: true
                },
                order: { stop_order: 'ASC' },
                relations: ['route']
            });

            const routeTimeMap: Record<number, { first_departure: string | null, last_arrival: string | null }> = {};
            routeIds.forEach(routeId => {
                const stops = routeStops.filter(stop => stop.route.route_id === routeId);
                const firstDepartureStop = stops.find(s => s.departure_time);
                const lastArrivalStop = [...stops].reverse().find(s => s.arrival_time);

                routeTimeMap[routeId] = {
                    first_departure: firstDepartureStop?.departure_time || null,
                    last_arrival: lastArrivalStop?.arrival_time || null
                };
            });

            const filteredBusSchedules = validSchedules.filter(schedule => {
                const routeId = schedule.route?.route_id;
                const firstDeparture = routeTimeMap[routeId]?.first_departure;

                if (!firstDeparture) return false;

                if (dateStr === today) {
                    const departureTime = moment(`${today} ${firstDeparture}`, "YYYY-MM-DD HH:mm");
                    return departureTime.isAfter(now);
                }

                return true;
            });

            const bookings = await bookingRepository.find({
                where: {
                    travel_date: dateStr,
                    route: In(routeIds),
                    is_deleted: false,
                    payment_status: true,
                    booking_status: 'Confirmed'
                },
                relations: ['route']
            });

            let passengerCounts: any[] = [];

            if (bookings.length > 0) {
                const bookingIds = bookings.map(b => b.id);

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
                const booking = bookings.find(b => b.id === booking_id);
                const routeId = booking?.route?.route_id;

                if (routeId) {
                    passengerCountMap[routeId] = (passengerCountMap[routeId] || 0) + Number(passenger_count);
                }
            });

            const busesForTheDay = filteredBusSchedules.map(schedule => {
                const routeId = schedule.route?.route_id;
                const timing = routeTimeMap[routeId] || { first_departure: null, last_arrival: null };

                if (!timing.first_departure) return null;

                const departureTime = moment(`${dateStr} ${timing.first_departure}`, "YYYY-MM-DD HH:mm");

                if (dateStr === today && !departureTime.isAfter(now)) return null;

                const bookingCount = passengerCountMap[routeId] || 0;

                return {
                    ...schedule,
                    travel_date: dateStr,
                    first_departure_time: timing.first_departure,
                    last_arrival_time: timing.last_arrival,
                    booking_count: bookingCount
                };
            }).filter(Boolean);
            finalBuses.push(...busesForTheDay);
        }
        return handleSuccess(res, 200, "Upcoming Buses Retrieved Successfully", finalBuses);
    } catch (error: any) {
        console.log(error);
        return handleError(res, 500, error.message);
    }
};