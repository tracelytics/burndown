class Github
  API_HOSTNAME = "https://api.github.com"

  def self.hostname?
    ENV.key?('GITHUB_HOSTNAME')
  end

  def self.hostname
    if self.hostname?
      ENV['GITHUB_HOSTNAME']
    else
      self.API_HOSTNAME
    end
  end
end
