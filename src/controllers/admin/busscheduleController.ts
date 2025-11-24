import Joi from "joi";
import { Request, Response } from "express";
import { getRepository, Like, Not } from "typeorm";
import { handleSuccess, handleError, joiErrorHandle } from "../../utils/responseHandler";
import { BusSchedule } from "../../entities/BusSchedule";
import { Route_Stops } from "../../entities/RouteStop";

export const create_busschedule = async (req: Request, res: Response) => {
    try {
        const createBusscheduleSchema = Joi.object({
            bus_id: Joi.number().required(),
            route_id: Joi.number().required(),
            available: Joi.boolean().required().allow(true, false),
            from: Joi.date().optional().allow(null, ''),
            to: Joi.date().optional().allow(null, '').greater(Joi.ref('from')).messages({
                'any.required': 'End date (to) is required',
                'date.base': 'End date (to) must be a valid date',
                'date.greater': 'End date (to) must be after the start date (from)',
            }),
            recurrence_pattern: Joi.string().valid("Daily", "Weekly", "Custom").required(),
            days_of_week: Joi.string().optional(),
        });

        const { error, value } = createBusscheduleSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { bus_id, route_id, available, from, to, recurrence_pattern, days_of_week } = value;

        const busscheduleRepository = getRepository(BusSchedule);

        const duplicateSchedule = await busscheduleRepository.findOne({ where: { route: { route_id: route_id, is_deleted: false } } });
        if (duplicateSchedule) return handleError(res, 400, "A schedule already exists for the specified route/line. Please choose another route/line.");

        const newBusschedule = busscheduleRepository.create({
            bus: bus_id,
            route: route_id,
            available: available,
            from: available == false ? from : null,
            to: available == false ? to : null,
            recurrence_pattern,
            days_of_week: days_of_week || null,
        });

        await busscheduleRepository.save(newBusschedule);
        return handleSuccess(res, 200, "Bus Schedule Successfully.");
    } catch (error: any) {
        console.error("Error in create_bus:", error);
        return handleError(res, 500, error.message);
    }
};

export const get_all_busschedule = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 10, search = '', filter = '' } = req.query;

        const pageNumber = parseInt(page as string, 10);
        const pageLimit = parseInt(limit as string, 10);
        const offset = (pageNumber - 1) * pageLimit;

        const busscheduleRepository = getRepository(BusSchedule);
        const routeStopsRepository = getRepository(Route_Stops);

        const whereConditions = [];
        if (search) {
            whereConditions.push(
                { recurrence_pattern: Like(`%${search}%`) },
                { bus: { bus_name: Like(`%${search}%`) } },
                { bus: { bus_number_plate: Like(`%${search}%`) } }
            );
        }

        const [busSchedulesRaw] = await busscheduleRepository.findAndCount({
            where: whereConditions.length > 0 ? whereConditions : [],
            relations: ['bus', 'route'],
            order: { schedule_id: 'DESC' },
            take: pageLimit,
            skip: offset,
        });

        const busSchedules = busSchedulesRaw.filter(schedule => !schedule.route?.is_deleted);

        const filteredSchedulesWithStops = await Promise.all(
            busSchedules.map(async (schedule) => {
                const routeStops = await routeStopsRepository.find({
                    where: { route: { route_id: schedule.route.route_id } },
                    relations: ["stop_city"],
                    order: { stop_order: 'ASC' },
                });

                if (!routeStops.length) return null;

                const firstStop = routeStops[0];
                const lastStop = routeStops[routeStops.length - 1];

                if (filter == "1" && (!firstStop?.stop_city?.from_ukraine || lastStop?.stop_city?.from_ukraine)) {
                    return null;
                }

                if (filter == "2" && (firstStop?.stop_city?.from_ukraine || !lastStop?.stop_city?.from_ukraine)) {
                    return null;
                }

                return { ...schedule, route_stops: routeStops };
            })
        );

        const finalSchedules = filteredSchedulesWithStops.filter((schedule) => schedule !== null);
        const totalSchedules = finalSchedules.length;
        const totalPages = Math.ceil(totalSchedules / pageLimit);

        return handleSuccess(res, 200, 'Bus schedules found successfully', {
            schedulesWithStops: finalSchedules,
            pagination: {
                totalSchedules,
                totalPages,
                currentPage: pageNumber,
                pageSize: pageLimit,
            },
        });
    } catch (error: any) {
        console.error("Error in getAllCity:", error);
        return handleError(res, 500, error.message);
    }
};

export const get_all_busschedule_byid = async (req: Request, res: Response) => {
    try {
        const deleteBusscheduleSchema = Joi.object({
            schedule_id: Joi.number().required()
        });

        const { error, value } = deleteBusscheduleSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { schedule_id } = value;

        const busscheduleRepository = getRepository(BusSchedule);

        const busscheduleResult = await busscheduleRepository.findOne({
            where: { schedule_id },
            relations: ['bus', 'route']
        });

        if (!busscheduleResult) return handleError(res, 404, 'Bus schedule not found');

        return handleSuccess(res, 200, 'Bus schedule successfully found', busscheduleResult)
    } catch (error: any) {
        console.error("Error in get_all_busschedule_byid:", error);
        return handleError(res, 500, error.message);
    }
};

export const update_busschedule = async (req: Request, res: Response) => {
    try {
        const updateBusscheduleSchema = Joi.object({
            schedule_id: Joi.number().required(),
            bus_id: Joi.number().required(),
            route_id: Joi.number().required(),
            available: Joi.boolean().required().allow(true, false),
            from: Joi.date().optional().allow(null, ''),
            to: Joi.date().optional().allow(null, '').greater(Joi.ref('from')).messages({
                'any.required': 'End date (to) is required',
                'date.base': 'End date (to) must be a valid date',
                'date.greater': 'End date (to) must be after the start date (from)',
            }),
            recurrence_pattern: Joi.string().valid("Daily", "Weekly", "Custom").required(),
            days_of_week: Joi.string().optional(),
        });

        const { error, value } = updateBusscheduleSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { schedule_id, bus_id, route_id, available, from, to, recurrence_pattern, days_of_week } = value;

        const busscheduleRepository = getRepository(BusSchedule);

        const busscheduleResult = await busscheduleRepository.findOne({ where: { schedule_id } });
        if (!busscheduleResult) return handleError(res, 404, 'Bus schedule not found');

        const existingRoute = await busscheduleRepository.find({ where: { route: { route_id: route_id }, schedule_id: Not(schedule_id) } });
        if (existingRoute.length > 0) return handleError(res, 400, 'Route ID already exists');

        if (bus_id) busscheduleResult.bus = bus_id;
        if (route_id) busscheduleResult.route = route_id;
        busscheduleResult.available = available;
        busscheduleResult.from = available == false ? from : null;
        busscheduleResult.to = available == false ? to : null;
        if (recurrence_pattern) busscheduleResult.recurrence_pattern = recurrence_pattern;
        if (days_of_week) busscheduleResult.days_of_week = days_of_week;

        await busscheduleRepository.save(busscheduleResult);

        return handleSuccess(res, 200, 'Bus schedule successfully');
    } catch (error: any) {
        console.error("Error in update_busschedule:", error);
        return handleError(res, 500, error.message);
    }
};

export const delete_busschedule = async (req: Request, res: Response) => {
    try {
        const deleteBusscheduleSchema = Joi.object({
            route_id: Joi.number().required()
        });

        const { error, value } = deleteBusscheduleSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { schedule_id } = value;

        const busscheduleRepository = getRepository(BusSchedule);

        const busscheduleResult = await busscheduleRepository.findOne({ where: { route: value.route_id, is_deleted: false } });
        if (!busscheduleResult) return handleError(res, 404, 'Bus schedule not found or already deleted');

        if (busscheduleResult) busscheduleResult.is_deleted = true
        return handleSuccess(res, 200, 'Bus schedule deleted successfully');
    } catch (error: any) {
        console.error("Error in delete_busschedule:", error);
        return handleError(res, 500, error.message);
    }
};

export const get_all_busschedule_by_route_id = async (req: Request, res: Response) => {
    try {
        const deleteBusscheduleSchema = Joi.object({
            route_id: Joi.number().required()
        });

        const { error, value } = deleteBusscheduleSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { route_id } = value;

        const busscheduleRepository = getRepository(BusSchedule);

        const busscheduleResult = await busscheduleRepository.find({
            where: { route: { route_id } },
            order: { schedule_id: 'DESC' },
            relations: ['bus', 'route']
        });
        if (!busscheduleResult) return handleError(res, 404, 'Bus schedule not found');

        return handleSuccess(res, 200, 'Bus schedule successfully found', busscheduleResult)
    } catch (error: any) {
        console.error("Error in get_all_busschedule_by_route_id:", error);
        return handleError(res, 500, error.message);
    }
};