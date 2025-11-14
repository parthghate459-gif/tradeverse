
import useSWR from 'swr';
import axios from 'axios';
const fetcher = url => axios.get(url).then(r=>r.data);
export default function Home(){
  const { data } = useSWR('/api/challenges', fetcher);
  return (
    <div style={{padding:20}}>
      <h1>TradeVerse</h1>
      <p>Play simulated trading challenges and win rewards.</p>
      <ul>
        {data && data.map(c => (
          <li key={c.id}>
            <b>{c.name}</b> - ₹{c.price_inr} - Target {c.target_pct}%
            <br/>
            {c.payment_link ? (
              <a href={c.payment_link} target="_blank" rel="noreferrer">Pay via Cashfree</a>
            ) : (
              <span>No payment link</span>
            )}
          </li>
        ))}
      </ul>
      <p>After payment, go to /verify to confirm your reference and get your demo account.</p>
    </div>
  )
}
