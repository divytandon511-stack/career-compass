/**
 * Basic health check controller.
 * Verifies that the HTTP application is responsive without claiming database/service readiness.
 */
export const getHealth = (req, res) => {
  res.status(200).json({
    data: {
      status: 'ok',
    },
  });
};

