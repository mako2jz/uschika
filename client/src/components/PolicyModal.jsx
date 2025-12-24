import React from 'react';

const PolicyModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-70 backdrop-blur-sm">
      <div className="bg-[#1e1e1e] text-gray-200 rounded-lg shadow-xl max-w-xl max-h-[90vh] overflow-y-auto font-sans">
        <div className="p-6 space-y-6">
          <div className="flex justify-between items-start">
            <h2 className="text-2xl font-bold text-white">Terms of Service & Privacy Policy</h2>
          </div>

          <div className="space-y-4 text-sm leading-relaxed">
            <section>
              <h3 className="text-lg font-semibold text-[#7ed957] mb-2">1. Eligibility</h3>
              <p>
                This service is exclusively available to students of the University of San Carlos (USC). 
                By using this platform, you certify that you are a currently enrolled student and are 
                <strong> 18 years of age or older</strong>.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#7ed957] mb-2">2. Privacy & Data Collection</h3>
              <p>
                <strong>What we collect:</strong> We collect your USC email address solely for the purpose of authentication via magic link. 
                We do not sell or share your personal data with third parties.
              </p>
              <p className="mt-2">
                <strong>Messages:</strong> Your chat messages are stored temporarily on our servers for up to 24 hours to facilitate 
                message delivery and conversation history. After this period, they are automatically and permanently deleted. 
                We do not permanently archive, track, or analyze the content of your private conversations.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#7ed957] mb-2">3. User-Generated Content & Liability</h3>
              <p>
                You are solely responsible for the content (text, information, etc.) that you share on this platform. 
                The developer and operators of USChika assume <strong>no liability</strong> for user-generated content. 
                We do not pre-screen content, but we reserve the right to remove content or ban users who violate these terms.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-[#7ed957] mb-2">4. Code of Conduct</h3>
              <p>
                While USChika offers anonymity, we expect all users to uphold the values of the Carolinian community.
                <strong> Respect is mandatory.</strong> Harassment, hate speech, bullying, sexual harassment, and any form of 
                inappropriate behavior are strictly prohibited. Please treat your chat partners with dignity.
              </p>
            </section>
          </div>

          <div className="pt-4 pb-4 flex justify-end">
            <button
              onClick={onClose}
              className="hero-button"
            >
              I Understand
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PolicyModal;
