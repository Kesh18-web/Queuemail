'use client';

import { useEffect, useState } from 'react';

interface Dispatch {
  id: string;
  recipientEmail: string;
  subject: string;
  sentTime: string | null;
  status: string;
  errorMessage?: string;
  previewUrl?: string | null;
  campaign: {
    id: string;
    subject: string;
  };
}

interface SentEmailsProps {
  userId: string;
}

export default function SentEmails({ userId }: SentEmailsProps) {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSent();
  }, [userId]);

  const fetchSent = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/dispatches/sent?userId=${userId}`
      );
      const data = await response.json();
      if (data.success) {
        setDispatches(data.data);
      } else {
        setError('Failed to fetch sent emails');
      }
    } catch (err) {
      setError('Failed to fetch sent emails');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SENT':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case 'FAILED':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-lg shadow-xl p-8 text-center border border-white/20">
        <div className="text-gray-500 dark:text-gray-400">Loading sent emails...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-lg shadow-xl p-8 text-center border border-white/20">
        <div className="text-red-500 dark:text-red-400">{error}</div>
      </div>
    );
  }

  if (dispatches.length === 0) {
    return (
      <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-lg shadow-xl p-8 text-center border border-white/20">
        <div className="text-gray-500 dark:text-gray-400">No sent emails yet.</div>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
          Sent emails will appear here once campaigns are processed.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-lg shadow-xl overflow-hidden border border-white/20">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
          <thead className="bg-gray-50/50 dark:bg-zinc-800/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Subject
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Sent Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Preview
              </th>
            </tr>
          </thead>
          <tbody className="bg-white/50 dark:bg-zinc-900/50 divide-y divide-gray-200 dark:divide-zinc-700">
            {dispatches.map((dispatch) => (
              <tr key={dispatch.id} className="hover:bg-white/70 dark:hover:bg-zinc-800/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {dispatch.recipientEmail}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                  {dispatch.subject}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {dispatch.sentTime
                    ? new Date(dispatch.sentTime).toLocaleString()
                    : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                      dispatch.status
                    )}`}
                  >
                    {dispatch.status}
                  </span>
                  {dispatch.errorMessage && (
                    <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                      {dispatch.errorMessage}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {dispatch.previewUrl ? (
                    <a
                      href={dispatch.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      View email
                    </a>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
