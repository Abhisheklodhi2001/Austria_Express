import Joi from "joi";
import ejs, { name } from 'ejs';
import { Request, response, Response } from "express";
import { getRepository, Like, Not } from "typeorm";
import { handleSuccess, handleError, joiErrorHandle } from "../../utils/responseHandler";
import { CurrencyExchangeRate } from "../../entities/currency_exchange_rate";

export const addCurrencyExchange = async (req: Request, res: Response) => {
    try {
        const currencyExchangeSchema = Joi.object({
            from_currency: Joi.string().required(),
            to_currency: Joi.string().required(),
            rate: Joi.string().required()
        });

        const { error, value } = currencyExchangeSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { from_currency, to_currency, rate } = value;

        const currencyExchangeRepository = getRepository(CurrencyExchangeRate);

        const existing = await currencyExchangeRepository.findOne({ where: { from_currency, to_currency } });
        if (existing) {
            existing.rate = rate;
            await currencyExchangeRepository.save(existing);
            return handleSuccess(res, 200, "Currency exchange rate updated successfully.");
        }

        const newRate = currencyExchangeRepository.create({ from_currency, to_currency, rate });
        await currencyExchangeRepository.save(newRate);

        return handleSuccess(res, 201, "Currency exchange rate added successfully.");
    } catch (error: any) {
        console.error("Error in addCurrencyExchange:", error);
        return handleError(res, 500, error.message);
    }
};

export const getAllCurrencyExchange = async (req: Request, res: Response) => {
    try {
        const currencyExchangeRepository = getRepository(CurrencyExchangeRate);

        const currencyExchange = await currencyExchangeRepository.find({ order: { created_at: 'desc' } });

        return handleSuccess(res, 200, "Currency exchange entries retrieved successfully.", currencyExchange);
    } catch (error: any) {
        console.error("Error in getAllCurrencyExchange:", error);
        return handleError(res, 500, error.message);
    }
};

export const updateCurrencyExchange = async (req: Request, res: Response) => {
    try {
        const currencyExchangeSchema = Joi.object({
            from_currency: Joi.string().uppercase().length(3).required(),
            to_currency: Joi.string().uppercase().length(3).required(),
            rate: Joi.number().positive().required(),
            id: Joi.number().required()
        });

        const { error, value } = currencyExchangeSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { from_currency, to_currency, rate, id } = value;

        const currencyExchangeRepository = getRepository(CurrencyExchangeRate);
        const existingRate = await currencyExchangeRepository.findOne({ where: { id: id } });

        if (!existingRate) {
            return handleError(res, 404, "Currency exchange rate not found.");
        }

        existingRate.from_currency = from_currency;
        existingRate.to_currency = to_currency;
        existingRate.rate = rate;

        await currencyExchangeRepository.save(existingRate);

        return handleSuccess(res, 200, "Currency exchange rate updated successfully.");
    } catch (error: any) {
        console.error("Error in updateCurrencyExchange:", error);
        return handleError(res, 500, error.message);
    }
};
