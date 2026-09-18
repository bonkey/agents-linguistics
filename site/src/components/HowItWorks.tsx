/** Plain-language explanation of the score, with examples. Shown under the results. */
export function HowItWorks() {
  return (
    <section className="section how-section">
      <h2>How the score works</h2>
      <p>
        The score is not a win count. It answers one question for every style: <strong>how strong were the
        styles it beat?</strong> Beating a style that wins a lot counts for more than beating a style that loses
        everything. The method is called Bradley-Terry, and it is the same idea chess ratings use.
      </p>
      <ul className="how-list">
        <li>
          <strong>Chains count.</strong> If A beats B and B beats C, A ends above C even though they never met.
        </li>
        <li>
          <strong>Same record, different score.</strong> X and Y are both 2-0-0. X beat two styles that have wins of
          their own. Y beat two styles that lost every game. X scores higher, because its wins were harder.
        </li>
        <li>
          <strong>A loss to the leader costs little.</strong> Z is 2-0-1, and the one loss was to the top style. Z stays
          close to a 2-0-0 style, because losing to the strongest opponent says little about Z.
        </li>
        <li>
          <strong>A tie is half a win for each side.</strong>
        </li>
        <li>
          <strong>Reading the number.</strong> All scores add up to 100. A style at 20 is twice as strong as one at
          10, and would win about two picks out of three between them.
        </li>
        <li>
          <strong>Few picks, big swings.</strong> After ten picks most styles have one or two games, so one pick can
          move a score a lot. The order settles as you keep picking; the gaps shrink until the picks support them.
        </li>
      </ul>
    </section>
  )
}
