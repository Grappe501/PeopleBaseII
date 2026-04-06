type AskRequest = {
  prompt?: string;
};

const cannedResponses: Array<{ test: RegExp; answer: string }> = [
  {
    test: /black.*dem/i,
    answer:
      "The Ask PeopleBase module is currently in guarded placeholder mode. Next step: route this request into approved summary views for Black Democratic estimate and county comparisons.",
  },
  {
    test: /pulaski|saline|faulkner|white|perry|conway|van buren|cleburne/i,
    answer:
      "County-specific question detected. The next implementation pass should connect this Ask panel to county summary query modules and AR-02 filtered views.",
  },
  {
    test: /turnout|simulate|scenario/i,
    answer:
      "Simulation mode is planned next. This shell is ready for turnout, persuasion, and county-mix scenario modules once the normalized voter tables are in place.",
  },
];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AskRequest;
    const prompt = body.prompt?.trim() ?? "";

    if (!prompt) {
      return Response.json(
        { success: false, error: "Prompt is required." },
        { status: 400 }
      );
    }

    const match = cannedResponses.find((item) => item.test.test(prompt));

    return Response.json({
      success: true,
      data: {
        prompt,
        answer:
          match?.answer ??
          "Ask PeopleBase is live as a safe shell. The next pass should connect this endpoint to approved backend query modules and audited AI-assisted analysis flows.",
      },
    });
  } catch (error) {
    return Response.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
