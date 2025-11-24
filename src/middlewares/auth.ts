import jwt from "jsonwebtoken";
import { User } from "../entities/User";
import { Admin } from "../entities/Admin";
import { IUser } from "../models/User";
import { IAdmin } from "../models/Admin";
import { handleError } from "../utils/responseHandler";
import { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import { getRepository } from "typeorm";


dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET as string;

declare module 'express-serve-static-core' {
    interface Request {
        user?: IUser;
        admin?: IAdmin;
    }
}

export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authorizationHeader = req.headers['authorization'];
        if (!authorizationHeader) {
            return handleError(res, 401, "Unauthorized: No token provided")
        }
        const tokenParts = authorizationHeader.split(' ');
        if (tokenParts[0] !== 'Bearer' || tokenParts[1] === 'null' || !tokenParts[1]) {
            return handleError(res, 401, "Unauthorized: Invalid or missing token");
        }
        const token = tokenParts[1];

        let decodedToken;
        try {
            decodedToken = jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
        } catch (err) {
            return handleError(res, 401, "Unauthorized: Invalid token");
        }

        // const decodedToken = jwt.verify(token, JWT_SECRET) as { userId: number; email: string };

        const userRepository = getRepository(User);
        console.log(decodedToken.email, "User Connected");

        const user = await userRepository.findOneBy({ id: decodedToken.userId });
        if (!user) {
            return handleError(res, 404, "User Not Found")

        }
        req.user = user as IUser;
        next();
    } catch (error: any) {
        return handleError(res, 500, error.message)
    }
};

export const authenticateAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authorizationHeader = req.headers['authorization'];
        if (!authorizationHeader) {
            return handleError(res, 401, "Unauthorized: No token provided")
        }
        const tokenParts = authorizationHeader.split(' ');
        if (tokenParts[0] !== 'Bearer' || tokenParts[1] === 'null' || !tokenParts[1]) {
            return handleError(res, 401, "Unauthorized: Invalid or missing token");
        }
        const token = tokenParts[1];
        let decodedToken;
        try {
            decodedToken = jwt.verify(token, JWT_SECRET) as { adminId: number; email: string };
        } catch (err) {
            return handleError(res, 401, "Unauthorized: Invalid token");
        }

        const adminRepository = getRepository(Admin);
        console.log(decodedToken.email, "Admin Connected");
        const admin = await adminRepository.findOne({ where: { id: decodedToken.adminId } });
        if (!admin) {
            return handleError(res, 404, "Admin Not Found")
        }
        req.admin = admin as IAdmin;
        next();
    } catch (error: any) {
        return handleError(res, 500, error.message)
    }
};


