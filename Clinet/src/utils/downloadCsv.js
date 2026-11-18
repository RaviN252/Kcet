import api from '../api/client';

// Downloads a CSV from an admin export endpoint. Goes through the API client
// (not a plain link) so the admin's auth token is sent; the filename comes from
// the server's Content-Disposition header.
export async function downloadCsv(path, params, fallbackName) {
  const res = await api.get(path, { params, responseType: 'blob' });
  const match = /filename="([^"]+)"/.exec(res.headers['content-disposition'] || '');
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = match ? match[1] : fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
