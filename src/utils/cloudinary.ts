import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';

export let upload_file_with_cloudinary = async function (photo_url: string, public_id: string) {
    try {
        cloudinary.config({
            cloud_name: 'dalva70no',
            api_key: '152783613694938',
            api_secret: 'mbeNYCUN_VfRqkeeWvaC52l2fB4',
        });
        const uploadResult: UploadApiResponse | undefined = await cloudinary.uploader
            .upload(
                photo_url,
                {
                    public_id: public_id,
                }
            )
            .catch((error: UploadApiErrorResponse) => {
                console.error('Error during upload:', error);
                return undefined;
            });

        if (uploadResult) {
            console.log('Upload Result:', uploadResult);
        } else {
            console.log('Upload failed.');
        }

        const optimizeUrl: string = cloudinary.url('shoes', {
            fetch_format: 'auto',
            quality: 'auto',
        });

        console.log('Optimized URL:', optimizeUrl);

        const autoCropUrl: string = cloudinary.url('shoes', {
            crop: 'auto',
            gravity: 'auto',
            width: 500,
            height: 500,
        });

        console.log('Auto-cropped URL:', autoCropUrl);

    } catch (error) {
        console.error('An unexpected error occurred:', error);
    }
}