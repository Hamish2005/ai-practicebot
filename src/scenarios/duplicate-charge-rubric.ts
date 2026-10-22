/** Examples illustrate meaning; they are not mandatory scripts. */
export const duplicateChargeRubric = {
  acknowledge: {
    not_met: {
      description:
        "No recognition of the billing concern, a denial, or only a keyword. A refund offer alone does not establish that two charges were recognized.",
      examples: [
        "Refund.",
        "You were not charged twice.",
        "There must have been an error on our side.",
      ],
    },
    partial: {
      description:
        "Recognizes a payment problem but does not identify the extra charge or two payments for one order.",
      examples: [
        "I see there is a problem with your payment.",
        "I understand your billing concern.",
      ],
    },
    met: {
      description:
        "Explicitly recognizes that the customer paid twice or has an extra charge for the same purchase. Verification may still be needed; do not require an admission of fault.",
      examples: [
        "You were charged twice for the same order.",
        "I understand there is a duplicate payment on your order.",
      ],
    },
  },
  empathy: {
    not_met: {
      description:
        "No empathy, dismissive language, denial of concern, or merely naming the skill.",
      examples: ["Calm down.", "I'm not sorry.", "Empathy."],
    },
    partial: {
      description:
        "Offers a generic apology or acknowledgment without identifying the frustration, inconvenience, or impact.",
      examples: ["I'm sorry about that.", "I apologize."],
    },
    met: {
      description:
        "Validates frustration or impact, or apologizes specifically for the inconvenience. Do not require the exact word empathy or an apology when validation is already clear.",
      examples: [
        "That is frustrating.",
        "We are sorry for the inconvenience.",
        "I understand how stressful this is.",
      ],
    },
  },
  resolution: {
    not_met: {
      description:
        "No proposed help, refusal without an alternative, a keyword, or an unsupported assertion that a transaction has already happened. This exercise has no transaction tools.",
      examples: [
        "Refund.",
        "I won't refund you.",
        "I have already refunded the payment.",
      ],
    },
    partial: {
      description:
        "Shows an intention to help or a relevant preparatory step, but does not offer an owned, concrete remedy or an explicit escalation route.",
      examples: [
        "I will fix it.",
        "I'll sort this out for you.",
        "Could you share your order number so I can check both payments?",
      ],
    },
    met: {
      description:
        "Offers an owned, specific action to resolve the issue, such as requesting a duplicate-payment refund or a clearly defined billing-team escalation. A refund may depend on verification. Do not require a made-up guaranteed outcome.",
      examples: [
        "I can give you your money back.",
        "I will check your order and request a refund for the duplicate payment.",
        "I will escalate the duplicate charge to our billing team for a refund review.",
      ],
    },
  },
  next_steps: {
    not_met: {
      description:
        "No follow-up expectation; a remedy alone, a contact-detail question, or an unsupported claim that funds have already arrived is not an explanation of what happens next.",
      examples: [
        "What's your email address?",
        "Refund.",
        "The money is definitely back in your account now.",
      ],
    },
    partial: {
      description:
        "Mentions follow-up but leaves the channel, sequence, or timeframe too vague to set a useful expectation.",
      examples: ["You'll hear from us soon.", "I'll update you."],
    },
    met: {
      description:
        "Explains a clear next event, follow-up channel/process, or reasonable expected timeframe. One clear expectation is sufficient; do not require all three or a guaranteed bank-processing date.",
      examples: [
        "You will receive an email confirmation today.",
        "The refund should arrive in 3–5 business days.",
        "After I verify both payments, I will send you the refund confirmation by email.",
      ],
    },
  },
  confirm: {
    not_met: {
      description:
        "No invitation to agree to the proposed next step. A statement of agreement, unrelated question, or data-collection question is insufficient.",
      examples: ["Okay.", "Is the weather okay?", "What's your email address?"],
    },
    partial: {
      description:
        "Attempts to check agreement, but the question is ambiguous or no concrete plan had been established when it was asked. A later plan cannot retroactively turn an earlier question into full credit.",
      examples: ["Okay?", "Does that work for you? [asked before any plan]"],
    },
    met: {
      description:
        "Explicitly invites agreement to a concrete plan already proposed in this or an earlier learner turn. A future customer yes is not required; assess the learner behavior.",
      examples: [
        "Does that refund plan work for you?",
        "Is that acceptable to you? [after a specific plan]",
      ],
    },
  },
};
