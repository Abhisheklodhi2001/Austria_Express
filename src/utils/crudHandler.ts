import { Request, Response } from "express";
import { Repository, getRepository, ObjectLiteral, ObjectType } from "typeorm";
import { handleSuccess, handleError } from "./responseHandler";

type CrudAction = "create" | "read" | "update" | "delete";


interface CrudOptions<T extends ObjectLiteral> {
    model: ObjectType<T>;
    action: CrudAction;
    data?: any;
    conditions?: Partial<T>;
    relations?: string[];
    order?: any;
}

export const crudHandler = async <T extends ObjectLiteral>(
    options: CrudOptions<T>
) => {
    const repository: Repository<T> = getRepository(options.model);
    try {
        switch (options.action) {
            case "create":
                if (!options.data) {
                    throw new Error("Data is required for creation");
                }
                const newData = repository.create(options.data);
                return await repository.save(newData);

            case "read":
                let read_data = []
                read_data = await repository.find({
                    where: options.conditions || {},
                    relations: options.relations || [],
                    order: options.order || { created_at: "DESC" },
                });
                return read_data;

            case "update":
                if (!options.conditions || !options.data) {
                    throw new Error("Conditions and data are required for update");
                }
                const toUpdate = await repository.findOne({ where: options.conditions });
                if (!toUpdate) {
                    throw new Error("Resource not found");
                }
                repository.merge(toUpdate, options.data);
                return await repository.save(toUpdate);

            case "delete":
                if (!options.conditions) {
                    throw new Error("Conditions are required for deletion");
                }
                const toDelete = await repository.findOne({ where: options.conditions });
                if (!toDelete) {
                    throw new Error("Resource not found");
                }
                await repository.remove(toDelete);
                return { message: "Resource deleted successfully" };

            default:
                throw new Error("Invalid action");
        }
    } catch (error) {
        console.error(`Error in ${options.action}:`, error);
        throw error;
    }

};
