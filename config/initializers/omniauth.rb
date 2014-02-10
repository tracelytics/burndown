Rails.application.config.middleware.use OmniAuth::Builder do
  options = {}
  if Github.hostname?
      options = {
        :client_options => {
          :site => Github.hostname,
          :authorize_url => "#{Github.hostname}/login/oauth/authorize",
          :token_url => "#{Github.hostname}/login/oauth/access_token",
        }
      }
  end
  provider :github, ENV['GITHUB_KEY'], ENV['GITHUB_SECRET'], **options
end
