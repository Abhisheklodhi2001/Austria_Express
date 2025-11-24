import fs from 'fs-extra';
import path from 'path';
import { getRepository, Repository } from 'typeorm';
import { User } from '../entities/User';

export const deleteImageFile = async (
    entityOrName: string | any,
    id: number,
    filePath: string
) => {
    try {
        let repository: Repository<any>;
        if (typeof entityOrName === 'string') {
            repository = getRepository(entityOrName);
        } else if (entityOrName instanceof Function) {
            repository = getRepository(entityOrName);
        } else {
            throw Error('Invalid entity or entity name provided');
        }
        const document = await repository.findOne({ where: { id: id } });
        if (!document) {
            throw Error(`Document with ID ${id} not found`);
        }
        const keys = filePath.split('.');
        const imageName = keys.reduce((obj, key) => obj && obj[key] !== 'undefined' ? obj[key] : undefined, document);

        if (!imageName) {
            console.log('No image field found in the document');
            return;
        }
        const uploadsFolderPath = path.join(__dirname, '..', 'uploads');
        const imagePath = path.join(uploadsFolderPath, imageName);

        console.log('Uploads folder path:', uploadsFolderPath);
        console.log('Full image path:', imagePath);

        if (fs.existsSync(imagePath)) {
            await fs.unlink(imagePath);
            console.log(`Image file ${imageName} deleted successfully`);
            await repository.update(id, { image: null });
        } else {
            console.log(`Image file ${imageName} not found in the uploads folder`);
        }

    } catch (error) {
        console.error('Error deleting image file:', error);
        throw Error('Internal Server Error');
    }
};



let file_name = "1724666263114-image_2024_08_23T08_11_56_348Z.png";

(async () => {
    console.log("hello")
    await deleteImageFile(User, 1, file_name)
})()
