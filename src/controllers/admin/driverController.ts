import Joi from "joi";
import { getRepository, Like, Not } from "typeorm";
import { Request, Response } from "express";
import { Driver } from "../../entities/Driver";
import { handleSuccess, handleError, joiErrorHandle } from "../../utils/responseHandler";

const APP_URL = process.env.APP_URL as string;

export const create_driver = async (req: Request, res: Response) => {
    try {
        const createDriverSchema = Joi.object({
            driver_name: Joi.string().required(),
            driver_license_number: Joi.string().required(),
            driver_contact_number: Joi.string().required(),
            driver_address: Joi.string().optional(),
            driver_dob: Joi.date().optional(),
            is_active: Joi.boolean().optional(),
            driver_profile_picture: Joi.string().optional(),
            driver_rating: Joi.number().min(0).max(5).optional(),
            license_expiry_date: Joi.date().optional(),
            file: Joi.allow("").optional()
        });

        const { error, value } = createDriverSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);
        if (req.file != undefined) value.driver_profile_picture = req.file.filename
        const driverRepository = getRepository(Driver);

        const driverResult = await driverRepository.findOne({ where: { driver_license_number: value.driver_license_number, is_deleted: false } });
        if (driverResult) return handleError(res, 400, 'This licence number already exists')

        const newDriver = driverRepository.create(value);
        await driverRepository.save(newDriver);
        return handleSuccess(res, 200, "Driver Created Successfully.");
    } catch (error: any) {
        console.error("Error in create_driver:", error);
        return handleError(res, 500, error.message);
    }
};

export const get_all_drivers = async (req: Request, res: Response) => {
    try {
        const driverRepository = getRepository(Driver);
        const drivers = await driverRepository.find({ where: { is_deleted: false } });
        if (!drivers) return handleError(res, 200, 'Drivers not found');
        drivers.map((driver) => {
            driver.driver_profile_picture = driver.driver_profile_picture != null ? APP_URL + driver.driver_profile_picture : driver.driver_profile_picture
        })
        return handleSuccess(res, 200, "Drivers fetched successfully.", drivers);
    } catch (error: any) {
        console.error("Error in get_all_drivers:", error);
        return handleError(res, 500, error.message);
    }
};

export const get_all_drivers_by_search_limit = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;

        const pageNumber = parseInt(page as string, 10);
        const pageLimit = parseInt(limit as string, 10);

        const offset = (pageNumber - 1) * pageLimit;

        const driverRepository = getRepository(Driver);

        const [drivers, total] = await driverRepository.findAndCount({
            where: search ? [
                { driver_name: Like(`%${search}%`), is_deleted: false },
                { driver_license_number: Like(`%${search}%`), is_deleted: false },
                { driver_contact_number: Like(`%${search}%`), is_deleted: false },
            ] : { is_deleted: false },
            order: { driver_id: 'DESC' },
            take: pageLimit,
            skip: offset,
        });

        const totalPages = Math.ceil(total / pageLimit);

        return handleSuccess(res, 200, "Drivers fetched successfully.", {
            drivers,
            pagination: {
                total,
                totalPages,
                currentPage: pageNumber,
                pageSize: pageLimit,
            },
        });
    } catch (error: any) {
        console.error("Error in get_all_drivers_by_search_limit:", error);
        return handleError(res, 500, error.message);
    }
};

export const get_driver_by_id = async (req: Request, res: Response) => {
    try {
        const getDriverSchema = Joi.object({
            driver_id: Joi.number().required()
        });
        const { error, value } = getDriverSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);
        const { driver_id } = value;
        const driverRepository = getRepository(Driver);
        const driver = await driverRepository.findOneBy({ driver_id: driver_id, is_deleted: false });
        if (!driver) return handleError(res, 404, "Driver not found.");
        driver.driver_profile_picture = driver.driver_profile_picture != null ? APP_URL + driver.driver_profile_picture : driver.driver_profile_picture
        return handleSuccess(res, 200, "Driver fetched successfully.", driver);
    } catch (error: any) {
        console.error("Error in get_driver_by_id:", error);
        return handleError(res, 500, error.message);
    }
};

export const update_driver = async (req: Request, res: Response) => {
    try {
        const updateDriverSchema = Joi.object({
            driver_id: Joi.number().required(),
            driver_name: Joi.string().optional(),
            driver_license_number: Joi.string().optional(),
            driver_contact_number: Joi.string().optional(),
            driver_address: Joi.string().optional(),
            driver_dob: Joi.date().optional(),
            is_active: Joi.boolean().optional(),
            driver_profile_picture: Joi.string().optional(),
            driver_rating: Joi.number().min(0).max(5).optional(),
            license_expiry_date: Joi.date().optional(),
            file: Joi.allow("").optional()
        });

        const { error, value } = updateDriverSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { driver_id, driver_name, driver_license_number, driver_contact_number, driver_address, driver_dob } = value

        const driverRepository = getRepository(Driver);
        const driver = await driverRepository.findOneBy({ driver_id: driver_id, is_deleted: false });
        if (!driver) return handleError(res, 404, "Driver not found.");

        const duplicateDriver = await driverRepository.findOne({
            where:
                { driver_license_number, driver_id: Not(driver_id), is_deleted: false },
        });
        if (duplicateDriver) return handleError(res, 400, 'This licence number already exists')

        if (req.file != undefined) driver.driver_profile_picture = req.file.filename
        if (driver_name) driver.driver_name = driver_name
        if (driver_license_number) driver.driver_license_number = driver_license_number
        if (driver_contact_number) driver.driver_contact_number = driver_contact_number
        if (driver_address) driver.driver_address = driver_address
        if (driver_dob) driver.driver_dob = driver_dob

        await driverRepository.save(driver);
        return handleSuccess(res, 200, "Driver Updated Successfully.");
    } catch (error: any) {
        console.error("Error in update_driver:", error);
        return handleError(res, 500, error.message);
    }
};

export const update_driver_status = async (req: Request, res: Response) => {
    try {
        const updateDriverSchema = Joi.object({
            driver_id: Joi.number().required(),
            is_active: Joi.boolean().required(),
        });

        const { error, value } = updateDriverSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { driver_id, is_active } = value

        const driverRepository = getRepository(Driver);
        const driver = await driverRepository.findOneBy({ driver_id: driver_id });
        if (!driver) return handleError(res, 404, "Driver not found.");

        let response_message = 'Driver Activated Successfully '
        if (!is_active) response_message = 'Driver De-activated Successfully'
        driver.is_deleted = is_active

        await driverRepository.save(driver);

        return handleSuccess(res, 200, response_message);
    } catch (error: any) {
        console.error("Error in update_driver:", error);
        return handleError(res, 500, error.message);
    }
};

export const delete_driver = async (req: Request, res: Response) => {
    try {
        const deleteDriverSchema = Joi.object({
            driver_id: Joi.number().required()
        });

        const { error, value } = deleteDriverSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { driver_id } = value;
        const driverRepository = getRepository(Driver);

        const driver = await driverRepository.findOneBy({ driver_id: driver_id, is_deleted: false });
        if (!driver) return handleError(res, 404, "Driver not found or already deleted.");

        if (driver) driver.is_deleted = true;
        await driverRepository.save(driver);

        return handleSuccess(res, 200, "Driver Deleted Successfully.");
    } catch (error: any) {
        console.error("Error in delete_driver:", error);
        return handleError(res, 500, error.message);
    }
};