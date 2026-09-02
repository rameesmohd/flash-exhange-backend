const APPNAME = process.env.APPNAME || "FsQuickpay";

const partialCompletion = (userName, orderId, credited, total, remaining) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
    <div style="background: #0047ab; color: #fff; padding: 20px;">
      <h2 style="margin: 0;">${APPNAME}</h2>
    </div>

    <div style="padding: 20px;">
      <p>Hi,</p>

      <p>Your sell order with <strong>Order ID: #${orderId}</strong> has been <strong>partially completed</strong>.</p>

      <ul style="list-style: none; padding-left: 0; font-size: 16px;">
        <li>✅ <strong>Amount Credited:</strong> ₹${credited.toLocaleString()}</li>
        <li>💰 <strong>Total Order Value:</strong> ₹${total.toLocaleString()}</li>
        <li>📤 <strong>Remaining Balance:</strong> ₹${remaining.toLocaleString()}</li>
      </ul>

      <p>Our team is processing the remaining amount and will notify you once it’s fully completed.</p>

      <p>If you have any questions, feel free to contact us on Telegram:
      <a href="https://t.me/${APPNAME.toLowerCase()}support" style="color: #0047ab;">@${APPNAME.toLowerCase()}support</a></p>
    </div>

    <div style="background: #f9f9f9; padding: 20px; text-align: center; font-size: 14px; color: #666;">
      <p>Thank you for trading with <strong>${APPNAME}</strong>.</p>
      <p>🌐 <a href="https://www.${APPNAME.toLowerCase()}.com" style="color: #0047ab;">www.${APPNAME.toLowerCase()}.com</a></p>
    </div>
  </div>
`;


const orderCompleted = (orderId, totalCredited) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
    <div style="background: #0047ab; color: #fff; padding: 20px;">
      <h2 style="margin: 0;">${APPNAME}</h2>
    </div>

    <div style="padding: 20px;">
      <p>Hi,</p>

      <p>Your sell order with <strong>Order ID: #${orderId}</strong> has been <strong>successfully completed</strong>.</p>

      <ul style="list-style: none; padding-left: 0; font-size: 16px;">
        <li>✅ <strong>Total Amount Credited:</strong> ₹${totalCredited.toLocaleString()}</li>
      </ul>

      <p>We appreciate your trust in ${APPNAME}.</p>

      <p>For any support, reach out to us on Telegram: <a href="https://t.me/${APPNAME.toLowerCase()}support" style="color: #0047ab;">@${APPNAME.toLowerCase()}support</a></p>
    </div>

    <div style="background: #f9f9f9; padding: 20px; text-align: center; font-size: 14px; color: #666;">
      <p>Thank you for trading with <strong>${APPNAME}</strong>.</p>
      <p>🌐 <a href="https://www.${APPNAME.toLowerCase()}.com" style="color: #0047ab;">www.${APPNAME.toLowerCase()}.com</a></p>
    </div>
  </div>
`;

const otpVerification = (OTP) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
    <div style="background: #0047ab; color: #fff; padding: 20px;">
      <h2 style="margin: 0;">${APPNAME}</h2>
    </div>

    <div style="padding: 20px;">
      <p>Hi,</p>

      <p>Use the code below to verify your email address:</p>

      <div style="font-size: 32px; font-weight: bold; background: #f0f0f0; padding: 12px 24px; display: inline-block; letter-spacing: 4px; border-radius: 6px; margin: 20px 0;">
        ${OTP}
      </div>

      <p>This OTP will expire in <strong>10 minutes</strong>. If you didn’t request this, you can safely ignore this email.</p>

      <p>If you have questions, contact us on Telegram:
        <a href="https://t.me/${APPNAME.toLowerCase()}support" style="color: #0047ab;">@${APPNAME.toLowerCase()}support</a>
      </p>
    </div>

    <div style="background: #f9f9f9; padding: 20px; text-align: center; font-size: 14px; color: #666;">
      <p>Thank you for using <strong>${APPNAME}</strong>.</p>
      <p>🌐 <a href="https://www.${APPNAME.toLowerCase()}.com" style="color: #0047ab;">www.${APPNAME.toLowerCase()}.com</a></p>
    </div>
  </div>
`;


module.exports = {
    partialCompletion,
    orderCompleted,
    otpVerification
}