const { S3, SES } = require("aws-sdk");
const { parse } = require("lambda-multipart-parser");
const { STSClient, GetSessionTokenCommand } = require("@aws-sdk/client-sts");

const DURATION_SECONDS = 129600;
const RECEIVER_EMAIL = "kevinochoa8266@gmail.com";
const SENDER_EMAIL = "kevinochoa8266@gmail.com";
const BUCKET_NAME = "precise-printing-customer-art";

exports.handler = async function (event) {
  let eventResult;
  
  try {
    eventResult = await parse(event);
  } catch (error) {
    console.error("Failed to parse the incoming event", error);
  }

  if (eventResult.files.length() > 0) {
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

    let response;
    try {
      response = await sts.send(command);
    } catch (error) {
      console.error("This is an error from sts", error);
    }
    console.log("this is the response from await sts:", response);
    const credentials = response.Credentials;

    const ACCESS_KEY = credentials.AccessKeyId;
    const SECRET_KEY = credentials.SecretAccessKey;
    const SESSION_TOKEN = credentials.SessionToken;

    // Create an S3 client using the assumed role credentials
    const s3 = new S3({
      accessKeyId: ACCESS_KEY,
      secretAccessKey: SECRET_KEY,
      sessionToken: SESSION_TOKEN,
    });

    let uploadResult;

    for (const file of eventResult["files"]) {
      const params = {
        Bucket: BUCKET_NAME,
        Key: `${customerName}/${file.filename}`,
        Body: file.content,
      };

      const urlParams = {
        Bucket: BUCKET_NAME,
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
  }


  const customerName = eventResult["name"];
  const preSignedUrls = [];

  
  let resp;
  try {
    resp = await sendEmail(eventResult, preSignedUrls);
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
  let params;

  if (urls.length() > 0 ) {
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
          Data: "Precise Printing Contact Form: " + result["name"],
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
          Data: "Precise Printing Contact Form: " + result["name"],
          Charset: "UTF-8",
        },
      },
      Source: SENDER_EMAIL,
      ReplyToAddresses: [result["email"]],
    };

  }

 

  let emailPromise;
  try {
    emailPromise = await ses.sendEmail(params).promise();
  } catch (error) {
    console.error("this is the send email error", error);
  }

  console.log("this is the emailPromise", emailPromise);
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
