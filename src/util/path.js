export const getUrl = (path) => {
  const base = import.meta.env.BASE_URL

  if (base === '/') {
    return `/${path}`
  }

  return `${base}/${path}`
}
