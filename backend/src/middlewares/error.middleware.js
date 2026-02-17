function errorMiddleware(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  return res.status(500).json({
    ok: false,
    message: "Error interno",
    error: err.message
  });
}

export default errorMiddleware;