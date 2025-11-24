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

        const matchingCityPickupDropPoint = await connection.query(
            'SELECT * FROM ticket_type WHERE startPointCityId = ? AND endPointCityId = ? AND is_active = 1',
            [pickup_point, dropoff_point]
        );

        if (!matchingCityPickupDropPoint || matchingCityPickupDropPoint.length === 0)
            return handleError(res, 200, 'No routes/lines available.');

        const busesForSelectedDates: any[] = [];

        for (let i = 0; i < 3; i++) {
            const currentDate = moment(travel_date).add(i, 'days');
            const weekday = currentDate.format('dddd');

            const allBusesForRoutes: BusSchedule[] = await busScheduleRepository.find({
                where: {
                    route: In(
                        matchingCityPickupDropPoint
                            .filter((route: any) => route.Baseprice != null)
                            .map((route: any) => route.routeRouteId)
                    )
                },
                relations: ['bus', 'route']
            });

            const closedRoutes = await routeClosureRepository.find({
                where: {
                    route: In(matchingCityPickupDropPoint.map((route: any) => route.routeRouteId)),
                    from_date: LessThanOrEqual(currentDate.toDate()),
                    to_date: MoreThanOrEqual(currentDate.toDate())
                },
                relations: ['route']
            });

            const closedRouteIds = closedRoutes.map(rou => rou.route.route_id);

            for (const bus of allBusesForRoutes) {
                if (closedRouteIds.includes(bus.route.route_id)) continue;

                let isBusAvailable = false;

                if (!bus.available) {
                    if (bus.from && bus.to) {
                        isBusAvailable = currentDate.isBetween(moment(bus.from), moment(bus.to), 'day', '[]');
                    }
                } else {
                    isBusAvailable = true;
                }

                if (isBusAvailable) {
                    if (bus.recurrence_pattern === 'Daily' ||
                        (['Weekly', 'Custom'].includes(bus.recurrence_pattern) && bus.days_of_week?.includes(weekday))) {

                        const getAllBooking = await bookingRepository.find({
                            where: {
                                from: { city_id: pickup_point },
                                to: { city_id: dropoff_point },
                                route: { route_id: bus.route.route_id },
                                travel_date: currentDate.format('DD-MM-YYYY'),
                                is_deleted: false
                            }
                        });

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
                            order: { stop_order: "ASC" }
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

                        if (!pickupStop || !dropoffStop) continue;

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
                            }
                        }

                        const isValidTimeFormat = (time: string) => /^\d{2}:\d{2}$/.test(time);
                        if (!isValidTimeFormat(pickupStop.departure_time) || !isValidTimeFormat(dropoffStop.arrival_time)) continue;

                        const departureTimeStr = `${currentDate.format('YYYY-MM-DD')} ${pickupStop?.departure_time}`;
                        const arrivalTimeStr = `${currentDate.format('YYYY-MM-DD')} ${dropoffStop?.arrival_time}`;

                        let departureTime = moment(departureTimeStr, 'YYYY-MM-DD HH:mm');
                        let arrivalTime = moment(arrivalTimeStr, 'YYYY-MM-DD HH:mm');
                        if (arrivalTime.isBefore(departureTime)) arrivalTime.add(1, 'days');

                        const now = moment();
                        if (currentDate.isSame(now, 'day') && departureTime.isSameOrBefore(now)) continue;

                        const duration = moment.duration(arrivalTime.diff(departureTime));
                        const matchingRoute = matchingCityPickupDropPoint.find((route: any) =>
                            route.routeRouteId == bus.route.route_id &&
                            route.startPointCityId == pickup_point &&
                            route.endPointCityId == dropoff_point
                        );
                        
                        let basePriceInfo = null;
                        
                        if (matchingRoute?.Baseprice) {
                            const basePriceCopy = { ...matchingRoute };
                            basePriceCopy.Baseprice = Number((basePriceCopy.Baseprice * exchangeRate).toFixed(2));
                            basePriceInfo = basePriceCopy;
                        }

                        busesForSelectedDates.push({
                            ...(bus as any),
                            departure_time: departureTime.format('DD-MM-YYYY HH:mm'),
                            arrival_time: arrivalTime.format('DD-MM-YYYY HH:mm'),
                            duration: `${duration.hours()} hours ${duration.minutes()} minutes`,
                            base_price: basePriceInfo,
                            route_stops: routeStopsData,
                            pickupStop: pickupStop,
                            dropoffStop: dropoffStop,
                            total_booked_seats: totalPassengers,
                            travel_date: currentDate.format('DD-MM-YYYY')
                        });

                        if (busesForSelectedDates.length >= 3) break;
                    }
                }
            }

            if (busesForSelectedDates.length >= 3) break;
        }

        if (!busesForSelectedDates.length) {
            return handleError(res, 200, 'No buses available for the selected date or upcoming 2 days.');
        }

        return handleSuccess(res, 200, 'Buses found successfully.', busesForSelectedDates);
    } catch (error: any) {
        console.error('Error in bus_search:', error);
        return handleError(res, 500, error.message);
    }
};