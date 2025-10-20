const Joi = require('joi');

const validateProposal = (req, res, next) => {
  const schema = Joi.object({
    id: Joi.number().required(),
    admin: Joi.string().required(),
    title: Joi.string().required(),
    description: Joi.string().required(),
    startTime: Joi.number().optional(),
    endTime: Joi.number().optional(),
    duration: Joi.number().optional().default(86400),
    collateralToken: Joi.string().required(),
    maxSupply: Joi.string().required(),
    target: Joi.string().required(),
    data: Joi.string().optional(),
    marketAddress: Joi.string().optional(),
    proposalExecuted: Joi.boolean().optional(),
    proposalEnded: Joi.boolean().optional().default(false),
    isActive: Joi.boolean().optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};

const validateOrder = (req, res, next) => {
  const schema = Joi.object({
    orderType: Joi.string().valid('buy', 'sell').required(),
    orderExecution: Joi.string().valid('limit', 'market').optional().default('limit'),
    price: Joi.string().when('orderExecution', {
      is: 'limit',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
    amount: Joi.string().required(),
    userAddress: Joi.string().required(),
    slippage: Joi.string().optional(),
    txHash: Joi.string().optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
};

module.exports = {
  validateProposal,
  validateOrder
};
