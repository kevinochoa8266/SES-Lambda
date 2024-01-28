const { S3, SES } = require("aws-sdk");
const { parse } = require("lambda-multipart-parser");
const { STSClient, GetSessionTokenCommand } = require("@aws-sdk/client-sts");

const DURATION_SECONDS = 129600;
const RECEIVER_EMAIL = "test@test.com";
const SENDER_EMAIL = "test@test.com";
const BUCKET_NAME = "test-bucket";
const ERROR_MSG =
  "An error occurred while sending the email, please try again or email ABC Company directly at test@company.com.";

exports.handler = async function (event) {
  let eventResult;
  
  try {
    eventResult = await parse(event);
  } catch (error) {
    console.error("Failed to parse the incoming event: ", error);
    return createErrorResponse(ERROR_MSG);
  }

  const customerName = eventResult["name"];
  const preSignedUrls = [];

  if (eventResult.files.length > 0) {

    // Fetch STS credentials to grant presigned URLs a longer lifetime.
    const sts = new STSClient({
      region: "us-east-1",
      credentials: {
        accessKeyId: process.env.ACCESS_KEY_ID,
        secretAccessKey: process.env.SECRET_ACCESS_KEY,
      },
    });

    const command = new GetSessionTokenCommand({
      DurationSeconds: DURATION_SECONDS,
    });

    let sts_response;

    try {
      sts_response = await sts.send(command);
    } catch (error) {
      console.error("Failed to create STS credentials: ", error);
      return createErrorResponse(ERROR_MSG);
    }

    const credentials = sts_response.Credentials;

    const ACCESS_KEY = credentials.AccessKeyId;
    const SECRET_KEY = credentials.SecretAccessKey;
    const SESSION_TOKEN = credentials.SessionToken;

    // Create an S3 client using the assumed role credentials.
    const s3 = new S3({
      accessKeyId: ACCESS_KEY,
      secretAccessKey: SECRET_KEY,
      sessionToken: SESSION_TOKEN,
    });


    for (const file of eventResult["files"]) {
      // Params to create folder in s3 bucket with customer name.
      const bucket_params = {
        Bucket: BUCKET_NAME,
        Key: `${customerName}/${file.filename}`,
        Body: file.content,
      };

      try {
        await s3.upload(bucket_params).promise();
      } catch (error) {
        console.error("Error uploading file to s3: ", error);
        return createErrorResponse(ERROR_MSG);
      }

      // Params to create the sharable Presigned URL.
      const urlParams = {
        Bucket: BUCKET_NAME,
        Key: `${customerName}/${file.filename}`,
        Expires: 129600,
      };
      
      const url = s3.getSignedUrl("getObject", urlParams);
      preSignedUrls.push(url);
    }
  }

  try {
    await sendEmail(eventResult, preSignedUrls);
  } catch (error) {
    console.error("Unable to send email.", error);
    return createErrorResponse(ERROR_MSG);
  }

  return createSuccessResponse("Email was successfully sent.");
};

async function sendEmail(result, urls) {
  const ses = new SES();
  let params;

  if (urls.length > 0 ) {
    // Format all of the urls in the attachment body.
    let attachmentBody = "";
    for (let i = 0; i < urls.length; i++) {
      attachmentBody += `Attachment ${i + 1}:\n${urls[i]}\n\n`;
    }

    // Create the email parameters with attachments.
    params = {
      Destination: {
        ToAddresses: [RECEIVER_EMAIL],
      },
      Message: {
        Body: {
          Text: {
            Data: buildEmailContentWithAttachments(result, attachmentBody),
            Charset: "UTF-8",
          },
        },
        Subject: {
          Data: "Test Company Contact Form: " + result["name"],
          Charset: "UTF-8",
        },
      },
      Source: SENDER_EMAIL,
      ReplyToAddresses: [result["email"]],
    };
  } else {
    // Create the email parameters without attachments.
    params = {
      Destination: {
        ToAddresses: [RECEIVER_EMAIL],
      },
      Message: {
        Body: {
          Text: {
            Data: buildEmailContent(result),
            Charset: "UTF-8",
          },
        },
        Subject: {
          Data: "Test Company Contact Form: " + result["name"],
          Charset: "UTF-8",
        },
      },
      Source: SENDER_EMAIL,
      ReplyToAddresses: [result["email"]],
    };

  }

  try {
    await ses.sendEmail(params).promise();
  } catch (error) {
    console.error("Failed to send email.", error);
  }
}

function buildEmailContentWithAttachments(result, attachmentBody) {
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

function buildEmailContent(result) {
  return (
    "Name: " +
    result["name"] +
    "\nEmail: " +
    result["email"] +
    "\nMessage:\n" +
    result["message"]
  );
}

function createErrorResponse(errorMessage) {
  return {
    statusCode: 500,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({ message: errorMessage }),
  };
}

function createSuccessResponse(successMessage) {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({ message: successMessage }),
  };
}
