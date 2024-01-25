import { S3, SES } from "aws-sdk";
import { parse } from "lambda-multipart-parser";
import { STSClient, GetSessionTokenCommand } from "@aws-sdk/client-sts";

const DURATION_SECONDS = 129600;
const RECEIVER_EMAIL = "kevinochoa8266@gmail.com";
const SENDER_EMAIL = "kevinochoa8266@gmail.com";

export const handler = async (event) => {
  // Fetch STS credentials to grant presigned URLs a lifetime of 36 hours.
  const sts = new STSClient({ region: "us-east-1" });

  const command = new GetSessionTokenCommand({
    DurationSeconds: DURATION_SECONDS,
  });
  let response;
  try {
    response = await sts.send(command);
  } catch (error) {
    console.error("This is an error from sts", error);
  }
  console.log("this is the response from await sts:", response);
  const credentials = response.Credentials;

  const s3 = new S3({
    credentials: credentials,
  });
  let eventResult;
  try{
    eventResult = await parse(event);

  } catch(error) {
    console.error("failed to parse the event", error);
  }
  console.log("this is the parsed event", eventResult);

  const customerName = result["name"];
  const bucketName = "precise-printing-customer-art";
  const preSignedUrls = [];
  let uploadResult;

  for (const file of result["files"]) {
    const params = {
      Bucket: bucketName,
      Key: `${customerName}/${file.filename}`,
      Body: file.content,
    };

    const urlParams = {
      Bucket: bucketName,
      Key: `${customerName}/${file.filename}`,
      Expires: 129600,
    };


    try {
      uploadResult = await s3.upload(params).promise();

    } catch (error) {
      console.error("this is an error uploading to s3", error);
    }

    console.log("File uploaded to S3:", uploadResult);

    const url = s3.getSignedUrl("getObject", urlParams);
    preSignedUrls.push(url);
  }
  let resp;
  try {
    
    resp = await sendEmail(result, preSignedUrls);
  } catch (error) {
    console.error("error sending email", error);
  }
  console.log("this is the sendEmail resp", resp);
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({ message: "Email sent successfully." }),
  };
};

async function sendEmail(result, urls) {
  const ses = new SES();

  // Format all of the urls in the attachment body.
  let attachmentBody = "";
  for (let i = 0; i < urls.length; i++) {
    attachmentBody += `Attachment ${i + 1}:\n${urls[i]}\n\n`;
  }

  // Create the email parameters.
  const params = {
    Destination: {
      ToAddresses: [RECEIVER_EMAIL],
    },
    Message: {
      Body: {
        Text: {
          Data: buildEmailContent(result, attachmentBody),
          Charset: "UTF-8",
        },
      },
      Subject: {
        Data: "Precise Printing Contact Form: " + result["name"],
        Charset: "UTF-8",
      },
    },
    Source: SENDER_EMAIL,
    ReplyToAddresses: [result["email"]],
  };

  let emailPromise;
  try {
    emailPromise = await ses.sendEmail(params).promise();
  } catch (error) {
    console.error("this is the send email error", error);
  }

  console.log("this is the emailPromise", emailPromise);
}

function buildEmailContent(result, attachmentBody) {
  return (
    "Name: " +
    result["name"] +
    "\nEmail: " +
    result["email"] +
    "\nMessage:\n" +
    result["message"] +
    "\n\nAttachments:\n\n" +
    attachmentBody
  );
}
