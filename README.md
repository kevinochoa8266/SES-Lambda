# Contact Form Using AWS SES
## Description
This project includes a JavaScript Lambda function triggered by an API Gateway request whenever a user fills out a website's contact form. The Lambda function processes the request, storing any user uploads or attachments in an S3 bucket. It then uses AWS SES to create email parameters and sends an email to the website owner with the contact form information. Attachments are included in the email as pre-signed URL links, valid for up to 36 hours. This method enhances security and reduces the SES cost by avoiding direct attachment sending.

## Features
Event Driven Architecture

## Dependencies
This project relies on the following AWS services:

AWS Lambda,
AWS SES (Simple Email Service),
Amazon S3,
API Gateway,
IAM (Identity and Access Management),
STS (Security Token Service)

## Contact
For questions or support, please contact Kevin Ochoa at kevinochoa8266@gmail.com.
