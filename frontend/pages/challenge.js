
import { useRouter } from 'next/router';
import axios from 'axios';
export default function Challenge(){
  const router = useRouter();
  const { id } = router.query;
  return (
    <div style={{padding:20}}>
      <h1>Challenge {id}</h1>
      <p>Click the Cashfree link on homepage to pay, then return here and verify payment.</p>
    </div>
  )
}
