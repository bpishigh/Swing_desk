# bd-m2-sepaflat replay diagnostic (descriptive only; no rule changed, no new test)

Source: the same replay as C-219 (1 Jan 2021 to 13 Nov 2026), re-run only to save the trades. Price returns before costs.

- **Legs:** 246 = 194 full exits + 52 half sales. Every full exit is labelled "stop" because the engine's exits (first stop, breakeven stop after the half sale, 50-day stop) all run through the stop test. The earlier "79% stopped out" in C-219 divided 194 by 246 and was wrong; the correct reading is below.
- **Winners:** 32.5% of full exits; average win +19.7%, average loss -9.1% (median -10.0%); average per trade +0.3% before costs.
- **Initial stop:** the realised median loss is -10.0%, so the 10% cap binds. A flat base up to 15% deep puts the base low beyond 10% below the buy for most signals. His published average loss is 5% to 6%.
- **Half sale:** reached on 52 of 194 trades (27%).
- **Speed:** median hold 21 days; 27% of full exits within 5 days, 34% within 10.
- **Entry:** the next open was a median 3.2% above the base top; 28% opened more than 5% above it (the 5% rule is applied on the signal-day close, not the next open).
- **By exit year:** 2021 47% winners (avg +6.7%); 2022 16% (-6.9%); 2023 30% (+3.5%); 2024 40% (+4.7%); 2025 26% (-5.1%); 2026 39% (+0.6%).
- **Signal funnel (rows logged for names reaching the base stage):** breakout volume under 150%: 616; volume did not dry up: 484; earnings below the floor: 391; no earnings figure: 278; bought: 200; slots full: 127; held: 24.

Reading: the book wins about a third of the time with wins twice the size of losses, so before costs it is about break-even per trade; costs and 12.5% sizing at a 10% stop turn that into a loss. Poor years are 2022 and 2025 (choppy markets). Any change suggested by this (a tighter stop, an entry-distance test on the open) is a new hypothesis for a pre-registered holdout, not a change to C-218.
