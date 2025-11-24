import { Response } from 'express';

export const handleError = (res: Response, statusCode: number, message: string) => {
  return res.status(statusCode).send({
    success: false,
    status: statusCode,
    message: message
  });
};


export const handleSuccess = (res: Response, statusCode: number, message: string, ...data: any[]) => {
  return res.status(statusCode).json({
    success: true,
    status: statusCode,
    message: message,
    data: data.length > 0 ? data[0] : undefined,
  });
};


export const joiErrorHandle = (res: Response, error: any) => {
  return res.status(400).send({
    success: false,
    status: 400,
    message: error.details[0].message
  });
};
