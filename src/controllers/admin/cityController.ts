import Joi from "joi";
import { Request, Response } from "express";
import { getRepository, Like, Not } from "typeorm";
import { handleSuccess, handleError, joiErrorHandle } from "../../utils/responseHandler";
import { City } from "../../entities/City";
import { get_lat_long } from "../../utils/function";

const APP_URL = process.env.APP_URL as string;

export const createCity = async (req: Request, res: Response) => {
    try {
        const createCitySchema = Joi.object({
            city_name: Joi.string().required(),
            city_address: Joi.string().required()
        });

        const { error, value } = createCitySchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const cityRepository = getRepository(City);

        const duplicateCity = await cityRepository.findOne({ where: { city_name: value.city_name, is_deleted: false } });
        if (duplicateCity) return handleError(res, 400, "This bus stop already exists. Please add a different stop.");

        const latLong = await get_lat_long(value.city_address);
        if (!latLong || !latLong.lat || !latLong.lng) return handleError(res, 400, "Invalid city address. Could not fetch latitude and longitude.");

        const newCityData = {
            city_name: value.city_name,
            city_address: value.city_address,
            latitude: latLong.lat,
            longitude: latLong.lng
        };

        const newCity = cityRepository.create(newCityData);
        await cityRepository.save(newCity);

        return handleSuccess(res, 201, "Bus stop added successfully.");
    } catch (error: any) {
        console.error("Error in createCity:", error);
        return handleError(res, 500, "An error occurred while creating the city.");
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

export const getCityById = async (req: Request, res: Response) => {
    try {
        const citySchema = Joi.object({
            city_id: Joi.number().required(),
        });

        const { error, value } = citySchema.validate(req.query);
        if (error) return joiErrorHandle(res, error);

        const { city_id } = value;

        const cityRepository = getRepository(City);

        const cityResult = await cityRepository.findOne({ where: { city_id: city_id, is_deleted: false } });
        if (!cityResult) return handleError(res, 404, 'Bus stop not found.');

        cityResult.city_image = cityResult.city_image == null ? `${APP_URL}/uploads/${cityResult.city_image}` : '';

        return handleSuccess(res, 200, 'Bus stop retrieved successfully.', cityResult);
    } catch (error: any) {
        console.error("Error in getAllCity:", error);
        return handleError(res, 500, error.message);
    }
};

export const updateCity = async (req: Request, res: Response) => {
    try {
        const updateCitySchema = Joi.object({
            city_id: Joi.number().required(),
            city_name: Joi.string().required(),
            city_description: Joi.string().optional().allow(null, ''),
            city_address: Joi.string().required(),
            latitude: Joi.number().precision(7).required(),
            longitude: Joi.number().precision(7).required(),
            from_ukraine: Joi.boolean().required(),
            is_active: Joi.boolean().required(),
        });

        const { error, value } = updateCitySchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { city_id, city_name, city_description, city_address, latitude, longitude, from_ukraine, is_active } = value;

        const cityRepository = getRepository(City);

        const cityResult = await cityRepository.findOne({ where: { city_id: city_id, is_deleted: false } });
        if (!cityResult) return handleError(res, 404, 'Bus stop not found.');

        const duplicateCity = await cityRepository.findOne({ where: { city_name, city_id: Not(city_id), is_deleted: false } });
        if (duplicateCity) return handleError(res, 400, "This bus stop already exists. Please add a different stop.");

        Object.assign(cityResult, {
            city_name,
            city_description,
            city_address,
            latitude,
            longitude,
            from_ukraine,
            is_active,
            city_image: req.file ? req.file.filename : cityResult.city_image,
        });

        await cityRepository.save(cityResult);

        return handleSuccess(res, 200, 'Bus stop updated successfully.');
    } catch (error: any) {
        console.error("Error in updateCity:", error);
        return handleError(res, 500, error.message);
    }
};

export const deleteCityById = async (req: Request, res: Response) => {
    try {
        const deleteCitySchema = Joi.object({
            city_id: Joi.number().required()
        });

        const { error, value } = deleteCitySchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { city_id } = value;

        const cityRepository = getRepository(City);

        const cityResult = await cityRepository.findOne({ where: { city_id: city_id, is_deleted: false } });

        if (!cityResult) return handleError(res, 404, 'City not found or already deleted');

        cityResult.is_deleted = true;
        
        await cityRepository.save(cityResult);
        return handleSuccess(res, 200, 'City deleted successfully');
    } catch (error: any) {
        console.error("Error in getAllCity:", error);
        return handleError(res, 500, error.message);
    }
};

export const getAllActiveCity = async (req: Request, res: Response) => {
    try {
        const cityRepository = getRepository(City);

        const cityResult = await cityRepository.find({ where: { is_deleted: false, is_active: true } });

        if (!cityResult) return handleError(res, 404, 'No bus stops found.');

        return handleSuccess(res, 200, 'Bus stops retrieved successfully.', cityResult);
    } catch (error: any) {
        console.error("Error in getAllCity:", error);
        return handleError(res, 500, error.message);
    }
};