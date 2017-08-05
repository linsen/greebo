
// Return a string representing the value in Rands of centValue.
exports.getRandValue = (centValue) => {
  const cents = Math.floor(centValue) % 100;
  const centsString = (cents + 100).toString().slice(-2);

  const integer = Math.floor(centValue / 100);
  const reversed = integer.toString().split('').reverse().join('');
  const comma = reversed.replace(/(\d{3})/g, '$1 ').trim().replace(/\s/g, ',');
  const normalComma = comma.split('').reverse().join('');
  return `${normalComma}.${centsString}`;
};
