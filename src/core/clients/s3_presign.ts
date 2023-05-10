import AWS from "aws-sdk";

const s3 = new AWS.S3({
    accessKeyId: `${process.env.S3_UPLOAD_KEY!}`,
    secretAccessKey: `${process.env.S3_UPLOAD_SECRET!}`,
    region: `${process.env.S3_UPLOAD_REGION}`
});

const bucketName = `${process.env.S3_UPLOAD_BUCKET}`;

const preSignedUrls = (urls: string[]) => {
    let concat_urls: string[] = [];

    for (let i = 0; i < urls.length; i++) {
        concat_urls.push(
            s3.getSignedUrl('getObject', {
                Bucket: bucketName,
                Key: urls[i].substring(urls[i].indexOf(`${process.env.S3_UPLOAD_REGION!}`) + process.env.S3_UPLOAD_REGION!.length + 15),
                Expires: 3600 // URL expires after one hour
            })
        );
    }

    if (urls.length < 2) {
        let concat_urls_string: string = concat_urls.join(",");
        return concat_urls_string;
    } else {
        return concat_urls;
    }
};

export default preSignedUrls;
