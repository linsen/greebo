
// Return a string representing the value in Rands of centValue.
exports.getDateFromString = (dateString) => {
  // Date is in format 'yyyy-mm-dd'
  var parts = dateString.split('-');
  // Note that Javascript counts months from 0:
  // January - 0, February - 1, etc
  var date = new Date(Date.UTC(parts[0], parts[1]-1, parts[2])); 
  return date;
};
