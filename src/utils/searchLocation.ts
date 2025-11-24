import Joi from "joi";
import axios from "axios"
import { Request, Response } from "express";
import { handleSuccess, handleError, joiErrorHandle } from "./responseHandler";

export const get_location = async (req: Request, res: Response) => {
    try {
        const findLatlongSchema = Joi.object({
            location: Joi.string().required()
        });

        const { error, value } = findLatlongSchema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { location } = value;
        const googleApiKey = process.env.GOOGLE_API_KEY

        if (!googleApiKey) return handleError(res, 500, 'Google API key is not set');

        const response = await axios({
            method: 'get',
            url: `https://maps.googleapis.com/maps/api/place/autocomplete/json?key=${googleApiKey}&input=${location}`,
        });

        return handleSuccess(res, 200, 'Location data fetched successfully', response.data.predictions);
    } catch (error: any) {
        return handleError(res, 500, error.message)
    }
};

export const get_address_by_latlong = async (req: Request, res: Response) => {
    try {
        const schema = Joi.object({
            lat: Joi.number().required(),
            lng: Joi.number().required(),
        });

        const { error, value } = schema.validate(req.body);
        if (error) return joiErrorHandle(res, error);

        const { lat, lng } = value;
        const googleApiKey = process.env.GOOGLE_API_KEY;

        if (!googleApiKey) return handleError(res, 500, 'Google API key is not set');

        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleApiKey}`;

        const response = await axios.get(url);

        const formattedAddress = response.data.results[0]?.formatted_address;

        if (!formattedAddress) return handleError(res, 404, 'No address found for provided coordinates');

        return handleSuccess(res, 200, 'Address fetched successfully', {
            address: formattedAddress,
            place_id: response.data.results[0]?.place_id,
            raw: response.data.results[0],
        });

    } catch (error: any) {
        return handleError(res, 500, error.message);
    }
};