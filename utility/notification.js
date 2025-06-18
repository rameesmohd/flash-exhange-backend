const notificationModel = require('../model/notification');

const generateNotificationData = () => {
  // Weighted array: more chances for '9'
  const startDigitOptions = ['9', '9', '9', '8', '7', '6']; // ~50% chance of '9'
  const startDigit = startDigitOptions[Math.floor(Math.random() * startDigitOptions.length)];
  const secondDigit = Math.floor(Math.random() * 10); // 0-9
  const hiddenDigits = Math.floor(1000 + Math.random() * 9000); // last 4 digits

  const phone = `${startDigit}${secondDigit}****${hiddenDigits}`;

  const min = 100, max = 3000;
  const isMultipleOf5 = Math.random() < 0.2;

  const rawAmount = isMultipleOf5
    ? Math.round((Math.random() * (max - min) + min) / 5) * 5
    : Math.random() * (max - min) + min;

  const amount = rawAmount.toFixed(2);

  return {
    phone,
    amount,
    timestamp: new Date()
  };
};


const getRandomDelay = () => {
  const min = 20000;   // 20 sec
  const max = 200000;  // 200 sec
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const insertRandomly = async () => {
  const data = generateNotificationData();
  await notificationModel.create(data);

  const nextDelay = getRandomDelay();
  console.log(`✅ Inserted: ${data.phone} sold $${data.amount} | Next in ${Math.floor(nextDelay / 1000)}s`);
  setTimeout(insertRandomly, nextDelay);
};

insertRandomly();
