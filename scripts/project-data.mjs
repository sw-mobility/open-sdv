import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

export function createProjectValidator(schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  return (data) => {
    validate(data);
    const errors = (validate.errors || []).map((error) => ({ path: error.instancePath.slice(1).split('/')[0] || error.params.missingProperty, message: error.message }));
    for (const key of ['repository', 'homepage', 'documentation']) {
      if (data[key] && !/^https?:\/\//i.test(data[key])) errors.push({ path: key, message: 'HTTP 또는 HTTPS 주소를 입력하세요.' });
    }
    const people = Array.isArray(data.maintainers) ? data.maintainers : [];
    if (people.some((person) => !person?.name || !person?.role)) errors.push({ path: 'maintainers', message: '담당자의 이름과 역할을 모두 입력하세요.' });
    if (people.some((person) => person?.github && !/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(person.github))) errors.push({ path: 'maintainers', message: 'GitHub 주소 대신 계정명만 입력하세요.' });
    return errors;
  };
}

// Pages CMS may omit cleared optional fields; normalize only empty values.
export function normalizeProjectSource(source) {
  const data = { ...source };
  // Ignore the retired field if an already-open CMS form submits an old value.
  delete data.maturity;
  delete data.status;
  delete data.demo;
  for (const key of ['name', 'summary', 'license', 'repository', 'homepage', 'documentation', 'repository_status']) if (typeof data[key] === 'string') data[key] = data[key].trim();
  if (!data.repository_status) data.repository_status = 'unconfirmed';
  for (const key of ['body', 'summary', 'license']) if (data[key] == null) data[key] = '';
  for (const key of ['categories', 'sdv_layers', 'technologies', 'integrates_with', 'maintainers']) {
    if (data[key] == null || data[key] === '') data[key] = [];
  }
  for (const key of ['categories', 'sdv_layers', 'technologies', 'integrates_with']) if (Array.isArray(data[key])) {
    data[key] = [...new Set(data[key].map(value => typeof value === 'string' ? value.trim() : value).filter(value => value !== ''))];
  }
  for (const key of ['repository', 'homepage', 'documentation']) if (data[key] == null || data[key] === '') delete data[key];
  if (Array.isArray(data.maintainers)) data.maintainers = data.maintainers.map(person => {
    if (!person || typeof person !== 'object') return person;
    const result = { ...person };
    for (const key of ['name', 'role', 'github']) if (typeof result[key] === 'string') result[key] = result[key].trim();
    if (!result.github) delete result.github;
    return result;
  });
  return data;
}
