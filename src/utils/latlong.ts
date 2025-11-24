import Joi from "joi";
import axios from "axios"
import { Request, Response } from "express";
import { handleSuccess, handleError, joiErrorHandle } from "./responseHandler";

export const get_lat_long = async (req: Request, res: Response) => {
    try {
        const findLatlongSchema = Joi.object({
            address: Joi.string().required()
        });

        const { error, value } = findLatlongSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { address } = value;
        const googleApiKey = process.env.GOOGLE_API_KEY

        if (!googleApiKey) return handleError(res, 500, 'Google API key is not set');

        const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: {
                address,
                key: googleApiKey,
            },
        });

        const { results, status } = response.data;

        // Check for successful response status
        if (status !== 'OK') {
            return handleError(res, 400, `Google API Error: ${status}`);
        }

        if (results && results.length > 0) {
            const { lat, lng } = results[0].geometry.location;
            const data = { lat, lng }
            return handleSuccess(res, 200, 'Lat-Long Fetched', data);
        } else {
            return handleError(res, 404, 'No results found');
        }
    } catch (error: any) {
        return handleError(res, 500, error.message);
    }
};