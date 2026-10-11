// Age in whole years from an ISO birth date (null when unknown)
function ageOf(dateOfBirth, now = new Date()) {
    if (!dateOfBirth) return null;
    const birth = new Date(dateOfBirth);
    let age = now.getFullYear() - birth.getFullYear();
    if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age--;
    return Number.isFinite(age) ? age : null;
}

module.exports = { ageOf };
