import { handleApi } from '../../src/api.js';

export default (req) => handleApi(req);

export const config = { path: '/api/*' };
