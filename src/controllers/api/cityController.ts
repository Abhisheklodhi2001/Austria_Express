import Joi from "joi";
import { Request, Response } from "express";
import { getRepository, ILike, IsNull, Like, Not } from "typeorm";
import { handleSuccess, handleError, joiErrorHandle } from "../../utils/responseHandler";
import { City } from "../../entities/City";
import { TicketType } from "../../entities/TicketType";

export const searchCities = async (req: Request, res: Response) => {
    try {
        const searchCitySchema = Joi.object({
            city_name: Joi.string().required(),
            from_ukraine: Joi.boolean().optional().allow(true, false),
        });

        const { error, value } = searchCitySchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { city_name, from_ukraine } = value;
        const cityRepository = getRepository(City);

        const whereCondition: any = {
            city_name: ILike(`${city_name}%`),
            is_active: true,
            is_deleted: false,
        };

        if (typeof from_ukraine === "boolean") {
            whereCondition.from_ukraine = from_ukraine;
        }

        const cityResult = await cityRepository.find({ where: whereCondition });

        if (!cityResult) return handleError(res, 404, 'No cities found');

        return handleSuccess(res, 200, 'Cities found successfully', cityResult);
    } catch (error: any) {
        console.error("Error in getAllCity:", error);
        return handleError(res, 500, error.message);
    }
};

export const searchCitiesByCountry = async (req: Request, res: Response) => {
    try {
        const findCityByCountryNameSchema = Joi.object({
            country_name: Joi.string().required(),
            city_name: Joi.string().required()
        });

        const { error, value } = findCityByCountryNameSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { country_name, city_name } = value;

        const cityRepository = getRepository(City);

        const cityResult = await cityRepository.find({ where: { city_name: ILike(`${city_name}%`) } });

        if (!cityResult) return handleError(res, 404, 'Not cities found');

        return handleSuccess(res, 200, 'Cities found successfully', cityResult);
    } catch (error: any) {
        console.error("Error in getCityByCountryName:", error);
        return handleError(res, 500, error.message);
    }
};

export const getAllCity = async (req: Request, res: Response) => {
    try {
        const cityRepository = getRepository(City);

        const cityResult = await cityRepository.find({ where: { is_deleted: false } });

        if (!cityResult) return handleError(res, 404, 'No bus stops found.');

        return handleSuccess(res, 200, 'Bus stops retrieved successfully.', cityResult);
    } catch (error: any) {
        console.error("Error in getAllCity:", error);
        return handleError(res, 500, error.message);
    }
};

export const getToCityByFromCityId = async (req: Request, res: Response) => {
    try {
        const searchCitySchema = Joi.object({
            city_id: Joi.string().required()
        });

        const { error, value } = searchCitySchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { city_id } = value;
        const ticketTypeRepository = getRepository(TicketType);

        const fromCityResult = await ticketTypeRepository.find({ where: { is_deleted: false, Baseprice: Not(IsNull()), start_point: { city_id: city_id } }, relations: ['end_point'] });

        if (!fromCityResult) return handleError(res, 404, 'No bus stops found.');

        const uniqueCityMap = new Map();
        const uniqueDestinations = fromCityResult.filter(item => {
            const cityId = item.end_point?.city_id;
            if (!cityId || item.end_point?.is_deleted) return false;
            if (uniqueCityMap.has(cityId)) return false;
            uniqueCityMap.set(cityId, true);
            return true;
        }).map(item => item.end_point);

        return handleSuccess(res, 200, 'Bus stops retrieved successfully.', uniqueDestinations);
    } catch (error: any) {
        console.error("Error in getAllCity:", error);
        return handleError(res, 500, error.message);
    }
};