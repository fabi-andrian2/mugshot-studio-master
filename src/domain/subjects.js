const isSameSubject = (a, b) => {
  if (a === b) return true;
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  return keysA.every((key) => a[key] === b[key]);
};

export const areSubjectListsEqual = (a, b) =>
  a === b || (a.length === b.length && a.every((subject, i) => isSameSubject(subject, b[i])));