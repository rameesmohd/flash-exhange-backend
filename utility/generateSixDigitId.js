function generateSixDigitId() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // ensures 6-digit number, no leading zeros
  }
  
  module.exports = generateSixDigitId;
  