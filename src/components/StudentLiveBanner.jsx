import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Radio, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabaseClient.js';
import * as api from '../lib/api.js';
import '../live-ui.css';

export default function StudentLiveBanner() {
  const { user } = useAuth();
  const [liveClasses, setLiveClasses] = useState([]);

  useEffect(() => {
    let mounted = true;
    const channels = [];

    async function watch() {
      try {
        const classes = await api.listMyEnrolledClasses(user.id);
        if (!mounted || !classes?.length) return;

        const refresh = () => {
          const found = [];
          channels.forEach(({ classId, className, channel }) => {
            const state = channel.presenceState?.() || {};
            const teacherLive = Object.values(state).flat().some(meta => meta?.role === 'teacher' && meta?.live === true);
            if (teacherLive) found.push({ id: classId, name: className });
          });
          if (mounted) setLiveClasses(found);
        };

        for (const cls of classes) {
          const channel = supabase.channel(`hn-live:${cls.id}`);
          channel.on('presence', { event: 'sync' }, refresh);
          channel.on('presence', { event: 'join' }, refresh);
          channel.on('presence', { event: 'leave' }, refresh);
          channels.push({ classId: cls.id, className: cls.name, channel });
          await channel.subscribe();
          refresh();
        }
      } catch (e) {
        console.warn('[StudentLiveBanner]', e);
      }
    }

    watch();
    return () => {
      mounted = false;
      channels.forEach(({ channel }) => supabase.removeChannel(channel));
    };
  }, [user.id]);

  if (!liveClasses.length) return null;

  return (
    <section className="studentLiveBanner">
      <div className="studentLiveIcon"><Radio /></div>
      <div className="studentLiveText">
        <b>🔴 Giáo viên đang trực tiếp</b>
        <span>{liveClasses.map(c => c.name).join(' • ')}</span>
      </div>
      <Link className="studentLiveJoin" to={`/student/live?classId=${liveClasses[0].id}`}>
        Vào xem ngay <ArrowRight size={16} />
      </Link>
    </section>
  );
}
