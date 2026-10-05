export function MovementStudy() {
  return <div className="movement-study" aria-hidden="true">
    <div className="study-top"><span>MOVEMENT, IN PERSPECTIVE</span><span>FIG. 01</span></div>
    <svg viewBox="0 0 480 280" fill="none">
      <ellipse cx="245" cy="240" rx="150" ry="22" stroke="currentColor" opacity=".12" />
      <ellipse cx="245" cy="240" rx="100" ry="13" stroke="currentColor" opacity=".09" />
      <path d="M65 240H422M245 24V265" stroke="currentColor" opacity=".1" strokeDasharray="3 7" />
      <g stroke="#2455d6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M226 99L205 151L236 173L294 180L341 223M236 173L181 204L140 242M222 111L169 99L124 63M222 111L277 124L309 84"/><circle cx="237" cy="64" r="17"/></g>
      <g stroke="#b45327" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M241 99L225 149L250 170L304 185L356 231M250 170L200 208L156 242M237 111L184 84L156 43M237 111L289 110L318 62"/><circle cx="252" cy="64" r="17"/></g>
      {[[241,99],[225,149],[250,170],[304,185],[356,231],[200,208],[156,242],[237,111],[184,84],[156,43],[289,110],[318,62]].map(([cx,cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4" fill="#b45327" stroke="#f7f7f2" strokeWidth="2"/>)}
      <path d="M169 99Q172 84 184 84" stroke="#686862" strokeDasharray="2 3"/>
      <path d="M317 110H387" stroke="#b45327" opacity=".45"/><circle cx="317" cy="110" r="3" fill="#b45327"/>
      <text x="340" y="101" fill="#686862" fontSize="9" letterSpacing="1">LOOK CLOSER</text>
    </svg>
    <div className="study-bottom"><span><i/> Reference <i/> Your movement</span><span>Illustrative pose study</span></div>
  </div>;
}
